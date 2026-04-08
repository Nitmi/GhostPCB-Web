export const MIN_PROCESS_COUNT = 1
export const MAX_PROCESS_COUNT = 99
export const DEFAULT_PROCESS_COUNT = 1
export const ZIP_MIME_TYPE = 'application/zip'
export const ZIP_FILE_EXTENSION = '.zip'

export const PROCESS_PHASES = [
  'preparing',
  'analyzing',
  'processing',
  'packaging',
  'complete',
] as const

export type ProcessPhase = (typeof PROCESS_PHASES)[number]
