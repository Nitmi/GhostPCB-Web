import { encodeTextFile, normalizeLineEndings } from '../../shared/utils/text.ts'
import { createRng } from '../random/rng.ts'
import type { ArchiveEntry } from '../zip/unzip.ts'
import { isDrillType, isSilkscreenType } from './fileTypes.ts'
import { applyGerberExportProfile } from './exportProfiles.ts'
import { collectManufacturingEntries, collectPackageExtras } from './packageEntries.ts'
import { detectAltiumSource } from './detectExportSource.ts'
import { injectLcedaSignature } from './signature.ts'
import { applyCoordinateJitter } from './obfuscators/coordinateJitter.ts'
import { applySilkscreenShift } from './obfuscators/silkscreen.ts'
import type { GerberFileType, GerberTextEntry } from './types.ts'

const JITTER_MAX_MM: Partial<Record<Exclude<GerberFileType, 'drill' | 'unknown'>, number>> = {
  outline: 0.005,
  'top-copper': 0.003,
  'bottom-copper': 0.003,
  'inner-layer': 0.003,
  'top-silkscreen': 0.003,
  'bottom-silkscreen': 0.003,
  'top-mask': 0.003,
  'bottom-mask': 0.003,
  'top-paste': 0.003,
  'bottom-paste': 0.003,
}

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
    const jitterMax = JITTER_MAX_MM[entry.type as keyof typeof JITTER_MAX_MM]

    if (jitterMax) {
      content = applyCoordinateJitter(content, rng, jitterMax)
    }

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
      data: extra.data,
    })
  }

  return outputEntries
}

function normalizeDrillContent(content: string): string {
  return normalizeLineEndings(content)
}
