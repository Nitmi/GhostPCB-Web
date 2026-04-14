import { decodeTextFile, encodeTextFile } from '../../shared/utils/text.ts'
import { createRng } from '../random/rng.ts'
import type { ArchiveEntry } from '../zip/unzip.ts'
import { detectEasyEdaSource } from './detectEasyEda.ts'
import {
  detectGerberFileType,
  isDrillType,
  isKnownGerberType,
  isSilkscreenType,
} from './fileTypes.ts'
import { injectEasyEdaHeader } from './headers.ts'
import { injectLcedaSignature } from './signature.ts'
import type { GerberTextEntry } from './types.ts'
import { applySilkscreenShift } from './obfuscators/silkscreen.ts'

export interface GerberPipelineOptions {
  now: Date
  seed: number
  throwIfCanceled?: () => void
}

export function runGerberPipeline(
  entries: ArchiveEntry[],
  options: GerberPipelineOptions,
): ArchiveEntry[] {
  const { now, seed, throwIfCanceled } = options
  const rng = createRng(seed)
  const textEntries = new Map<string, GerberTextEntry>()

  for (const entry of entries) {
    const type = detectGerberFileType(entry.name)
    if (!isKnownGerberType(type)) {
      continue
    }

    textEntries.set(entry.name, {
      name: entry.name,
      type,
      content: decodeTextFile(entry.data, entry.name),
    })
  }

  const sourceLooksEasyEda = detectEasyEdaSource([...textEntries.values()])

  return entries.map((entry) => {
    throwIfCanceled?.()

    const textEntry = textEntries.get(entry.name)
    if (!textEntry) {
      return entry
    }

    if (isDrillType(textEntry.type)) {
      return entry
    }

    let content = textEntry.content

    if (isSilkscreenType(textEntry.type)) {
      content = applySilkscreenShift(content, rng)
    }

    if (!sourceLooksEasyEda) {
      content = injectEasyEdaHeader(content, textEntry.name, now)
    }

    content = injectLcedaSignature(content, rng)

    return {
      name: entry.name,
      data: encodeTextFile(content),
    }
  })
}
