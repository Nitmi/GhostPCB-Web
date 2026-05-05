import { isDrillType } from './fileTypes.ts'
import type { GerberTextEntry } from './types.ts'

export function detectAltiumSource(entries: GerberTextEntry[]): boolean {
  return entries.some(
    (entry) =>
      !isDrillType(entry.type) &&
      (entry.content.includes('TF.GenerationSoftware,Altium Limited,Altium Designer') ||
        entry.content.includes('Altium Designer')),
  )
}
