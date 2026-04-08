import type { ProcessPhase } from '../../../shared/constants/process.ts'

export type ProcessStatus = 'idle' | 'running' | 'success' | 'error'

export interface ProgressState {
  phase: ProcessPhase
  percent: number
  current: number
  total: number
  message: string
}

export interface DownloadableResult {
  fileName: string
  buffer: ArrayBuffer
  size: number
}
