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
import type { DrillFileRole, PackageExtraEntry, PreparedGerberEntry } from './types.ts'

const EXCELLON_EXTENSIONS = new Set(['DRL', 'TXT', 'XLN'])
const ORDER_README_NAME = 'PCB下单必读.txt'
const FLYING_PROBE_NAME = 'FlyingProbeTesting.json'
const ORDER_README_CONTENT = `如何进行PCB下单

请查看：
https://prodocs.lceda.cn/cn/pcb/order-order-pcb/index.html`

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

  for (const entry of entries) {
    const type = detectGerberFileType(entry.name)

    if (isKnownGerberType(type) && type !== 'drill') {
      const content = safeDecodeTextFile(entry.data, entry.name)
      if (!content) {
        continue
      }

      preparedEntries.push({
        name: entry.name,
        outputName: createUniqueOutputName(
          getNormalizedGerberFileName(entry.name, type),
          usedNames,
        ),
        type,
        content,
      })
      continue
    }

    if (type === 'drill' || isExcellonCandidateName(entry.name)) {
      const content = safeDecodeTextFile(entry.data, entry.name)
      if (!content || !isExcellonContent(content)) {
        continue
      }

      const drillRole = detectDrillRole(entry.name, content)
      preparedEntries.push({
        name: entry.name,
        outputName: createUniqueOutputName(getNormalizedDrillFileName(drillRole), usedNames),
        type: 'drill',
        drillRole,
        content,
      })
    }
  }

  return preparedEntries.sort(sortPreparedEntries)
}

export function collectPackageExtras(entries: ArchiveEntry[]): PackageExtraEntry[] {
  const extras = new Map<string, string>()

  extras.set(ORDER_README_NAME, ORDER_README_CONTENT)

  for (const entry of entries) {
    if (entry.name !== FLYING_PROBE_NAME) {
      continue
    }

    const content = safeDecodeTextFile(entry.data, entry.name)
    if (content) {
      extras.set(FLYING_PROBE_NAME, normalizeExtraContent(content))
      break
    }
  }

  return [...extras.entries()].map(([name, content]) => ({ name, content }))
}

function normalizeExtraContent(content: string): string {
  return content.replace(/\r\n?/g, '\n')
}
