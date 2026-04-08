import { isDrillType } from './fileTypes.ts'
import type { GerberTextEntry } from './types.ts'

export function detectEasyEdaSource(entries: GerberTextEntry[]): boolean {
  return entries.some(
    (entry) => !isDrillType(entry.type) && entry.content.includes('EasyEDA Pro'),
  )
}
