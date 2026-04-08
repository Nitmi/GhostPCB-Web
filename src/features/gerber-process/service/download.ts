import { ZIP_MIME_TYPE } from '../../../shared/constants/process.ts'
import type { DownloadableResult } from '../model/types.ts'

function triggerDownload(fileName: string, buffer: ArrayBuffer) {
  const blob = new Blob([buffer], { type: ZIP_MIME_TYPE })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadResultFile(result: DownloadableResult) {
  triggerDownload(result.fileName, result.buffer)
}

export function downloadAllResults(results: DownloadableResult[]) {
  for (const result of results) {
    triggerDownload(result.fileName, result.buffer)
  }
}
