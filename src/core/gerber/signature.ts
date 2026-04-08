import SparkMD5 from 'spark-md5'
import { normalizeLineEndings } from '../../shared/utils/text.ts'
import type { SeededRandom } from '../random/rng.ts'

const ADD_LINE_PATTERN = /^%ADD(\d+)(.+)%$/

function parseAddId(line: string): number | null {
  const matched = line.match(ADD_LINE_PATTERN)
  return matched ? Number(matched[1]) : null
}

function collectUsedApertureIds(lines: string[]): Set<number> {
  const usedIds = new Set<number>()

  for (const line of lines) {
    if (line.startsWith('%ADD')) {
      continue
    }

    for (const match of line.matchAll(/G54D(\d+)\*/g)) {
      usedIds.add(Number(match[1]))
    }

    for (const match of line.matchAll(/(?:^|[^A-Z])D(\d+)\*/g)) {
      const id = Number(match[1])
      if (id >= 10) {
        usedIds.add(id)
      }
    }
  }

  return usedIds
}

function shiftApertureId(id: number, baseId: number): number {
  return id >= baseId ? id + 1 : id
}

function renumberLine(line: string, baseId: number): string {
  let nextLine = line.replace(ADD_LINE_PATTERN, (_, id: string, rest: string) => {
    return `%ADD${shiftApertureId(Number(id), baseId)}${rest}%`
  })

  nextLine = nextLine.replace(/G54D(\d+)\*/g, (_, id: string) => {
    return `G54D${shiftApertureId(Number(id), baseId)}*`
  })

  nextLine = nextLine.replace(/(^|[^A-Z])D(\d+)\*/g, (_, prefix: string, id: string) => {
    const numericId = Number(id)
    if (numericId < 10) {
      return `${prefix}D${id}*`
    }

    return `${prefix}D${shiftApertureId(numericId, baseId)}*`
  })

  return nextLine
}

function deriveSignatureDigits(content: string): string {
  const digest = SparkMD5.hash(content)
  const tail = Number.parseInt(digest.slice(-1), 16)
  return String((tail % 90) + 10).padStart(2, '0')
}

function findSignatureInsertIndex(lines: string[]): number {
  let lastAddIndex = -1

  for (let index = 0; index < lines.length; index += 1) {
    if (parseAddId(lines[index]) !== null) {
      lastAddIndex = index
    }
  }

  if (lastAddIndex >= 0) {
    return lastAddIndex + 1
  }

  let lastControlIndex = -1
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.startsWith('%') || line.startsWith('G04')) {
      lastControlIndex = index
      continue
    }

    break
  }

  return lastControlIndex + 1
}

export function injectLcedaSignature(content: string, rng: SeededRandom): string {
  const normalized = normalizeLineEndings(content)
  const lines = normalized.split('\n')
  const usedIds = collectUsedApertureIds(lines)

  const keptLines = lines.filter((line) => {
    const id = parseAddId(line)
    return id === null || usedIds.has(id)
  })

  const apertureIds = keptLines
    .map((line) => parseAddId(line))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)

  const baseId = apertureIds.length > 0 ? rng.pick(apertureIds) : 10
  const renumberedLines = keptLines.map((line) => renumberLine(line, baseId))
  const renumberedContent = renumberedLines.join('\n')
  const signatureDigits = deriveSignatureDigits(renumberedContent)
  const signatureLine = `%ADD${baseId}C,0.${signatureDigits}*%`
  const insertIndex = findSignatureInsertIndex(renumberedLines)
  renumberedLines.splice(insertIndex, 0, signatureLine)

  return renumberedLines.join('\n')
}
