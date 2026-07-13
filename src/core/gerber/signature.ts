import SparkMD5 from 'spark-md5'
import type { SeededRandom } from '../random/rng.ts'

const APERTURE_MIN_ID = 10
const APERTURE_MAX_ID = 8191
const ADD_LINE_PATTERN = /^%ADD(\d{2,4})([^,]+),(.+)\*%$/
const USED_APERTURE_PATTERN = /(?:G54)?D(\d{2,4})\*/g

interface TextLayout {
  eol: '\n' | '\r\n'
  hasTrailingNewline: boolean
}

interface AddLine {
  id: number
  line: string
  lineIndex: number
  shape: string
  params: string
}

interface FirstParameterInfo {
  firstParam: string
  rest: string
  decimalPlaces: number
}

interface SignatureCarrierMatch {
  carrier: AddLine
  importedMode: boolean
}

function splitText(content: string): { layout: TextLayout; lines: string[] } {
  return {
    layout: {
      eol: content.includes('\r\n') ? '\r\n' : '\n',
      hasTrailingNewline: content.endsWith('\n'),
    },
    lines: content.split(/\r\n|\n/),
  }
}

function joinText(lines: string[], layout: TextLayout): string {
  const nextText = lines.join(layout.eol)
  return layout.hasTrailingNewline && nextText.length > 0 ? `${nextText}${layout.eol}` : nextText
}

function collectAddLines(lines: string[]): AddLine[] {
  return lines.flatMap((line, lineIndex) => {
    const matched = line.match(ADD_LINE_PATTERN)
    if (!matched) {
      return []
    }

    return [
      {
        id: Number(matched[1]),
        line,
        lineIndex,
        shape: matched[2] ?? '',
        params: matched[3] ?? '',
      },
    ]
  })
}

function collectUsedApertures(lines: string[]): Set<number> {
  const used = new Set<number>()

  for (const line of lines) {
    for (const matched of line.matchAll(USED_APERTURE_PATTERN)) {
      const apertureId = Number(matched[1])
      if (apertureId >= APERTURE_MIN_ID) {
        used.add(apertureId)
      }
    }
  }

  return used
}

function getFirstParameterInfo(params: string): FirstParameterInfo | null {
  const matched = params.match(/^([+-]?\d+(?:\.\d+)?)(.*)$/)
  if (!matched) {
    return null
  }

  const firstParam = matched[1] ?? ''
  const decimalPart = firstParam.split('.')[1] ?? ''

  return {
    firstParam,
    rest: matched[2] ?? '',
    decimalPlaces: decimalPart.length,
  }
}

function deriveMd5Pair(input: string): string {
  const digest = SparkMD5.hash(input)
  const lastByte = Number.parseInt(digest.slice(-2), 16)
  return String(lastByte % 100).padStart(2, '0')
}

function buildCarrierValue(firstParam: string, pair: string): string {
  let merged = `${Number.parseFloat(firstParam || '0.01').toFixed(2)}${pair}`

  if (Number.parseFloat(merged) === 0) {
    merged = '0.0100'
  }

  return merged
}

function buildCarrierLine(
  carrierId: number,
  template: AddLine | null,
  pair: string,
  rng: SeededRandom,
): string {
  if (template) {
    const parameterInfo = getFirstParameterInfo(template.params)
    if (parameterInfo) {
      return `%ADD${carrierId}${template.shape},${buildCarrierValue(parameterInfo.firstParam, pair)}${parameterInfo.rest}*%`
    }
  }

  const baseValue = Math.max(0.01, Math.min(0.99, rng.next()))
  return `%ADD${carrierId}C,${buildCarrierValue(baseValue.toFixed(4), pair)}*%`
}

function extractEmbeddedPair(firstParam: string): string | null {
  const decimalPart = firstParam.split('.')[1] ?? ''

  if (decimalPart.length >= 4) {
    return decimalPart.slice(2, 4)
  }

  if (decimalPart.length === 3) {
    return `${decimalPart[2]}0`
  }

  return null
}

function removeLine(lines: string[], lineIndex: number): string[] {
  return lines.filter((_, index) => index !== lineIndex)
}

function getCarrierSignatureMode(
  lines: string[],
  layout: TextLayout,
  candidate: AddLine,
): boolean | null {
  const parameterInfo = getFirstParameterInfo(candidate.params)
  if (!parameterInfo) {
    return null
  }

  const embeddedPair = extractEmbeddedPair(parameterInfo.firstParam)
  if (!embeddedPair) {
    return null
  }

  const contentWithoutCarrier = joinText(removeLine(lines, candidate.lineIndex), layout)
  if (deriveMd5Pair(contentWithoutCarrier) === embeddedPair) {
    return false
  }

  if (deriveMd5Pair(`494d${contentWithoutCarrier}`) === embeddedPair) {
    return true
  }

  return null
}

function findCurrentCarrier(
  lines: string[],
  layout: TextLayout,
  addLines: AddLine[],
  usedApertures: Set<number>,
): SignatureCarrierMatch | null {
  const candidates = addLines.filter((entry) => {
    if (usedApertures.has(entry.id)) {
      return false
    }

    const parameterInfo = getFirstParameterInfo(entry.params)
    return Boolean(parameterInfo && parameterInfo.decimalPlaces >= 4)
  })

  for (const candidate of candidates) {
    const importedMode = getCarrierSignatureMode(lines, layout, candidate)
    if (importedMode !== null) {
      return {
        carrier: candidate,
        importedMode,
      }
    }
  }

  return null
}

function allocateNextApertureId(addLines: AddLine[]): number | null {
  const usedIds = new Set(addLines.map((entry) => entry.id))
  const highestId = addLines.reduce((max, entry) => Math.max(max, entry.id), APERTURE_MIN_ID - 1)

  for (let nextId = Math.max(APERTURE_MIN_ID, highestId + 1); nextId <= APERTURE_MAX_ID; nextId += 1) {
    if (!usedIds.has(nextId)) {
      return nextId
    }
  }

  for (let nextId = APERTURE_MIN_ID; nextId <= APERTURE_MAX_ID; nextId += 1) {
    if (!usedIds.has(nextId)) {
      return nextId
    }
  }

  return null
}

function selectInsertionTemplate(addLines: AddLine[], rng: SeededRandom): AddLine | null {
  if (addLines.length <= 5) {
    return null
  }

  const slotIndex = Math.min(5 + Math.floor(rng.next() * 5), addLines.length - 1)
  return addLines[slotIndex] ?? null
}

function shiftApertureIds(lines: string[], insertionId: number): string[] {
  return lines.map((line) =>
    line.replace(/^(%ADD|G54D|D)(\d{2,4})(?=\D)/, (full, prefix, rawId) => {
      const apertureId = Number(rawId)
      if (
        !Number.isFinite(apertureId) ||
        apertureId < insertionId ||
        apertureId === APERTURE_MAX_ID
      ) {
        return full
      }

      return `${prefix}${apertureId + 1}`
    }),
  )
}

function findInsertionIndex(lines: string[], insertionId: number): number {
  const nextIdPattern = new RegExp(`^%ADD${insertionId + 1}(?=\\D)`)
  const nextAddIndex = lines.findIndex((line) => nextIdPattern.test(line))

  if (nextAddIndex >= 0) {
    return nextAddIndex
  }

  let metricsSeen = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (!metricsSeen) {
      if (/^%MO/i.test(line)) {
        metricsSeen = true
      }
      continue
    }

    if (/^%LP|^G/.test(line)) {
      let insertIndex = index
      while (insertIndex > 0 && (lines[insertIndex - 1] ?? '') === '') {
        insertIndex -= 1
      }
      return insertIndex
    }
  }

  const addLines = collectAddLines(lines)
  return (addLines.at(-1)?.lineIndex ?? -1) + 1
}

function buildHashBase(lines: string[], layout: TextLayout, importedMode: boolean): string {
  const text = joinText(lines, layout)
  return importedMode ? `494d${text}` : text
}

export function injectLcedaSignature(
  content: string,
  rng: SeededRandom,
  importedMode = false,
): string {
  const { layout, lines } = splitText(content)
  const addLines = collectAddLines(lines)

  if (addLines.length === 0) {
    return joinText(lines, layout)
  }

  const usedApertures = collectUsedApertures(lines)
  const currentCarrier = findCurrentCarrier(lines, layout, addLines, usedApertures)
  const resolvedImportedMode = currentCarrier?.importedMode ?? importedMode

  if (currentCarrier && currentCarrier.carrier.shape !== 'C') {
    const linesWithoutCarrier = removeLine(lines, currentCarrier.carrier.lineIndex)
    const signatureLine = buildCarrierLine(
      currentCarrier.carrier.id,
      currentCarrier.carrier,
      deriveMd5Pair(buildHashBase(linesWithoutCarrier, layout, resolvedImportedMode)),
      rng,
    )
    const nextLines = [...lines]
    nextLines[currentCarrier.carrier.lineIndex] = signatureLine
    return joinText(nextLines, layout)
  }

  const workingLines = currentCarrier ? removeLine(lines, currentCarrier.carrier.lineIndex) : [...lines]
  const workingAddLines = collectAddLines(workingLines)

  if (workingAddLines.length === 0 && currentCarrier) {
    const signatureLine = buildCarrierLine(
      currentCarrier.carrier.id,
      currentCarrier.carrier,
      deriveMd5Pair(
        buildHashBase(removeLine(lines, currentCarrier.carrier.lineIndex), layout, resolvedImportedMode),
      ),
      rng,
    )
    const nextLines = [...lines]
    nextLines[currentCarrier.carrier.lineIndex] = signatureLine
    return joinText(nextLines, layout)
  }

  const selectedTemplate = selectInsertionTemplate(workingAddLines, rng)
  const insertionId = selectedTemplate?.id ?? allocateNextApertureId(workingAddLines)

  if (insertionId === null) {
    return joinText(workingLines, layout)
  }

  const shiftedLines = shiftApertureIds(workingLines, insertionId)
  const signatureLine = buildCarrierLine(
    insertionId,
    selectedTemplate,
    deriveMd5Pair(buildHashBase(shiftedLines, layout, resolvedImportedMode)),
    rng,
  )
  const nextLines = [...shiftedLines]
  nextLines.splice(findInsertionIndex(shiftedLines, insertionId), 0, signatureLine)
  return joinText(nextLines, layout)
}
