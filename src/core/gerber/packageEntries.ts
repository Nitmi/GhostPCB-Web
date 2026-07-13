import { decodeTextFile } from '../../shared/utils/text.ts'
import type { ArchiveEntry } from '../zip/unzip.ts'
import {
  detectGerberFileType,
  getFileExtension,
  getInnerLayerOrder,
  isKnownGerberType,
} from './fileTypes.ts'
import {
  getNormalizedDrillFileName,
  getNormalizedGerberFileName,
} from './exportProfiles.ts'
import type {
  DrillFileRole,
  DrillMergeBucket,
  PackageExtraEntry,
  PreparedGerberEntry,
} from './types.ts'

const EXCELLON_EXTENSIONS = new Set(['DRL', 'TXT', 'XLN'])
const FLYING_PROBE_NAME = 'FlyingProbeTesting.json'

function safeDecodeTextFile(data: Uint8Array, fileName: string): string | null {
  try {
    return decodeTextFile(data, fileName)
  } catch {
    return null
  }
}

function isExcellonCandidateName(fileName: string): boolean {
  const extension = getFileExtension(fileName)
  if (EXCELLON_EXTENSIONS.has(extension)) {
    return true
  }

  return /(drill|xln|excellon|npth|pth|via)/i.test(fileName)
}

function isExcellonContent(content: string): boolean {
  return (
    content.includes('M48') &&
    (/T\d{1,2}C/i.test(content) || /T\d{1,2}\s*$/im.test(content) || /G90/im.test(content))
  )
}

function detectDrillRole(fileName: string, content: string): DrillFileRole {
  const normalizedName = fileName.toLowerCase()
  const normalizedContent = content.toLowerCase()

  if (
    normalizedName.includes('npth') ||
    normalizedContent.includes(';type=non_plated') ||
    normalizedContent.includes(';layer: npth_through')
  ) {
    return 'non-plated'
  }

  if (
    normalizedName.includes('via') ||
    normalizedContent.includes(';layer: pth_through_via') ||
    normalizedContent.includes('via')
  ) {
    return 'via'
  }

  return 'plated'
}

function createUniqueOutputName(outputName: string, usedNames: Set<string>): string {
  if (!usedNames.has(outputName)) {
    usedNames.add(outputName)
    return outputName
  }

  const dotIndex = outputName.lastIndexOf('.')
  const baseName = dotIndex >= 0 ? outputName.slice(0, dotIndex) : outputName
  const extension = dotIndex >= 0 ? outputName.slice(dotIndex) : ''
  let index = 2

  while (usedNames.has(`${baseName}_${index}${extension}`)) {
    index += 1
  }

  const nextName = `${baseName}_${index}${extension}`
  usedNames.add(nextName)
  return nextName
}

function sortPreparedEntries(left: PreparedGerberEntry, right: PreparedGerberEntry): number {
  const typeRank = new Map([
    ['top-copper', 10],
    ['inner-layer', 20],
    ['bottom-copper', 30],
    ['top-silkscreen', 40],
    ['bottom-silkscreen', 50],
    ['top-mask', 60],
    ['bottom-mask', 70],
    ['top-paste', 80],
    ['bottom-paste', 90],
    ['outline', 100],
    ['drill', 110],
  ])
  const drillRoleRank = new Map([
    ['non-plated', 0],
    ['plated', 1],
    ['via', 2],
  ])

  const leftRank = typeRank.get(left.type) ?? 999
  const rightRank = typeRank.get(right.type) ?? 999
  if (leftRank !== rightRank) {
    return leftRank - rightRank
  }

  if (left.type === 'inner-layer' && right.type === 'inner-layer') {
    return (
      (getInnerLayerOrder(left.name) ?? Number.MAX_SAFE_INTEGER) -
      (getInnerLayerOrder(right.name) ?? Number.MAX_SAFE_INTEGER)
    )
  }

  if (left.type === 'drill' && right.type === 'drill') {
    return (
      (drillRoleRank.get(left.drillRole ?? 'plated') ?? Number.MAX_SAFE_INTEGER) -
      (drillRoleRank.get(right.drillRole ?? 'plated') ?? Number.MAX_SAFE_INTEGER)
    )
  }

  return left.outputName.localeCompare(right.outputName)
}

export function collectManufacturingEntries(entries: ArchiveEntry[]): PreparedGerberEntry[] {
  const usedNames = new Set<string>()
  const preparedEntries: PreparedGerberEntry[] = []
  const drillBuckets = new Map<DrillFileRole, DrillMergeBucket>()
  const outlineEntries: PreparedGerberEntry[] = []

  for (const entry of entries) {
    const type = detectGerberFileType(entry.name)

    if (isKnownGerberType(type) && type !== 'drill') {
      const content = safeDecodeTextFile(entry.data, entry.name)
      if (!content) {
        continue
      }

      const preparedEntry: PreparedGerberEntry = {
        name: entry.name,
        outputName: createUniqueOutputName(
          getNormalizedGerberFileName(entry.name, type),
          usedNames,
        ),
        type,
        content,
      }

      if (type === 'outline') {
        outlineEntries.push(preparedEntry)
      } else {
        preparedEntries.push(preparedEntry)
      }
      continue
    }

    if (type === 'drill' || isExcellonCandidateName(entry.name)) {
      const content = safeDecodeTextFile(entry.data, entry.name)
      if (!content || !isExcellonContent(content)) {
        continue
      }

      const drillRole = detectDrillRole(entry.name, content)
      const existingBucket = drillBuckets.get(drillRole)

      if (existingBucket) {
        existingBucket.entries.push({
          name: entry.name,
          content,
        })
        continue
      }

      drillBuckets.set(drillRole, {
        outputName: createUniqueOutputName(getNormalizedDrillFileName(drillRole), usedNames),
        drillRole,
        entries: [
          {
            name: entry.name,
            content,
          },
        ],
      })
    }
  }

  for (const bucket of drillBuckets.values()) {
    preparedEntries.push({
      name: bucket.entries[0]?.name ?? bucket.outputName,
      outputName: bucket.outputName,
      type: 'drill',
      drillRole: bucket.drillRole,
      content: mergeDrillContents(bucket.entries.map((entry) => entry.content)),
    })
  }

  preparedEntries.push(...pickOutlineEntries(outlineEntries))

  return preparedEntries.sort(sortPreparedEntries)
}

export function collectPackageExtras(entries: ArchiveEntry[]): PackageExtraEntry[] {
  const extras = new Map<string, Uint8Array>()
  const reservedNames = new Set<string>()

  for (const entry of entries) {
    const type = detectGerberFileType(entry.name)

    if (isKnownGerberType(type)) {
      continue
    }

    if (type === 'unknown' && isExcellonCandidateName(entry.name)) {
      const content = safeDecodeTextFile(entry.data, entry.name)
      if (content && isExcellonContent(content)) {
        continue
      }
    }

    if (entry.name === FLYING_PROBE_NAME) {
      const content = safeDecodeTextFile(entry.data, entry.name)
      if (content) {
        extras.set(FLYING_PROBE_NAME, new TextEncoder().encode(normalizeExtraContent(content)))
        reservedNames.add(FLYING_PROBE_NAME)
        continue
      }
    }

    const outputName = createUniqueOutputName(entry.name, reservedNames)
    extras.set(outputName, entry.data.slice())
  }

  return [...extras.entries()].map(([name, data]) => ({ name, data }))
}

function normalizeExtraContent(content: string): string {
  return content.replace(/\r\n?/g, '\n')
}

function mergeDrillContents(contents: string[]): string {
  if (contents.length <= 1) {
    return contents[0] ?? ''
  }

  const normalizedContents = contents.map((content) => content.replace(/\r\n?/g, '\n'))
  const firstLines = normalizedContents[0]?.split('\n') ?? []
  const mergedLines: string[] = []
  const seenToolLines = new Set<string>()
  let firstBodyStartIndex = -1

  for (let index = 0; index < firstLines.length; index += 1) {
    const line = firstLines[index] ?? ''
    mergedLines.push(line)
    if (line === '%') {
      firstBodyStartIndex = index + 1
      break
    }
  }

  if (firstBodyStartIndex < 0) {
    return normalizedContents.join('\n')
  }

  for (const line of firstLines) {
    if (/^T\d+F/i.test(line) || /^T\d+C/i.test(line)) {
      seenToolLines.add(line)
    }
  }

  for (let index = firstBodyStartIndex; index < firstLines.length; index += 1) {
    const line = firstLines[index] ?? ''
    if (line === 'M30') {
      continue
    }

    mergedLines.push(line)
  }

  for (let index = 1; index < normalizedContents.length; index += 1) {
    const lines = normalizedContents[index]?.split('\n') ?? []
    let inHeader = true

    for (const line of lines) {
      if (inHeader) {
        if (/^T\d+F/i.test(line) || /^T\d+C/i.test(line)) {
          if (!seenToolLines.has(line)) {
            const insertIndex = mergedLines.findIndex((item) => item === '%')
            mergedLines.splice(insertIndex >= 0 ? insertIndex : mergedLines.length, 0, line)
            seenToolLines.add(line)
          }
          continue
        }

        if (line === '%') {
          inHeader = false
          continue
        }

        continue
      }

      if (line === 'M30') {
        continue
      }

      if (line.length === 0 && mergedLines.at(-1) === '') {
        continue
      }

      mergedLines.push(line)
    }
  }

  mergedLines.push('M30')
  return mergedLines.join('\n')
}

function pickOutlineEntries(entries: PreparedGerberEntry[]): PreparedGerberEntry[] {
  if (entries.length <= 1) {
    return entries
  }

  const gkoEntries = entries.filter((entry) => getFileExtension(entry.name) === 'GKO')
  if (gkoEntries.length > 0) {
    return [gkoEntries[0]]
  }

  const gmEntries = entries.filter((entry) => /^GM\d+$/i.test(getFileExtension(entry.name)))
  if (gmEntries.length > 0) {
    return [gmEntries[0]]
  }

  return [entries[0]]
}
