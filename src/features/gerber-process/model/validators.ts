import {
  MAX_PROCESS_COUNT,
  MIN_PROCESS_COUNT,
  ZIP_FILE_EXTENSION,
} from '../../../shared/constants/process.ts'

export function validateZipFile(file: File): { valid: boolean; message: string } {
  if (!file.name.toLowerCase().endsWith(ZIP_FILE_EXTENSION)) {
    return {
      valid: false,
      message: '只支持选择 .zip 格式的 Gerber 压缩包。',
    }
  }

  return { valid: true, message: '' }
}

export function normalizeCountInput(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_PROCESS_COUNT
  }

  return Math.max(MIN_PROCESS_COUNT, Math.min(MAX_PROCESS_COUNT, Math.round(value)))
}
