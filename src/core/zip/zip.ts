import { zipSync } from 'fflate'
import type { ArchiveEntry } from './unzip.ts'

export function zipArchive(entries: ArchiveEntry[]): Uint8Array {
  const payload = Object.fromEntries(entries.map((entry) => [entry.name, entry.data]))
  return zipSync(payload, { level: 6 })
}
