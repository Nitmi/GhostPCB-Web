import { unzipSync } from 'fflate'

export interface ArchiveEntry {
  name: string
  data: Uint8Array
}

export function unzipArchive(archive: Uint8Array): ArchiveEntry[] {
  let files: Record<string, Uint8Array>

  try {
    files = unzipSync(archive)
  } catch {
    throw new Error('ZIP 解压失败，请确认输入文件有效。')
  }

  const entries = Object.entries(files)
    .filter(([name]) => !name.endsWith('/'))
    .map(([name, data]) => ({ name, data }))

  if (entries.length === 0) {
    throw new Error('ZIP 为空，未找到可处理的文件。')
  }

  return entries
}
