import { encodeTextFile, normalizeLineEndings } from '../../shared/utils/text.ts'
import { createRng } from '../random/rng.ts'
import type { ArchiveEntry } from '../zip/unzip.ts'
import { isDrillType, isSilkscreenType } from './fileTypes.ts'
import { applyGerberExportProfile } from './exportProfiles.ts'
import { collectManufacturingEntries, collectPackageExtras } from './packageEntries.ts'
import { detectAltiumSource } from './detectExportSource.ts'
import { injectLcedaSignature } from './signature.ts'
import { applySilkscreenShift } from './obfuscators/silkscreen.ts'
import type { GerberTextEntry } from './types.ts'

export interface GerberPipelineOptions {
  now: Date
  seed: number
  throwIfCanceled?: () => void
  onSourceFlavorDetected?: (flavor: 'altium-designer') => void
}

export function runGerberPipeline(
  entries: ArchiveEntry[],
  options: GerberPipelineOptions,
): ArchiveEntry[] {
  const { now, seed, throwIfCanceled, onSourceFlavorDetected } = options
  const rng = createRng(seed)
  const manufacturingEntries = collectManufacturingEntries(entries)
  const sourceEntries: GerberTextEntry[] = manufacturingEntries.map((entry) => ({
    name: entry.name,
    type: entry.type,
    content: entry.content,
  }))
  const outputEntries: ArchiveEntry[] = []

  if (detectAltiumSource(sourceEntries)) {
    onSourceFlavorDetected?.('altium-designer')
  }

  for (const entry of manufacturingEntries) {
    throwIfCanceled?.()

    if (isDrillType(entry.type)) {
      outputEntries.push({
        name: entry.outputName,
        data: encodeTextFile(normalizeDrillContent(entry.content)),
      })
      continue
    }

    let content = entry.content

    if (isSilkscreenType(entry.type)) {
      content = applySilkscreenShift(content, rng)
    }

    content = applyGerberExportProfile(content, entry, now)
    content = injectLcedaSignature(content, rng)

    outputEntries.push({
      name: entry.outputName,
      data: encodeTextFile(content),
    })
  }

  for (const extra of collectPackageExtras(entries)) {
    outputEntries.push({
      name: extra.name,
      data: encodeTextFile(extra.content),
    })
  }

  return outputEntries
}

function normalizeDrillContent(content: string): string {
  return normalizeLineEndings(content)
}
