import type { ProcessPhase } from '../shared/constants/process.ts'

export interface WorkerProgressPayload {
  taskId: string
  phase: ProcessPhase
  percent: number
  current: number
  total: number
  message: string
}

export interface WorkerResultFile {
  fileName: string
  buffer: ArrayBuffer
  size: number
}

export interface StartProcessRequest {
  type: 'start'
  payload: {
    taskId: string
    fileName: string
    count: number
    seed: number
    fileBuffer: ArrayBuffer
  }
}

export interface CancelProcessRequest {
  type: 'cancel'
  payload: {
    taskId: string
  }
}

export interface ProgressMessage {
  type: 'progress'
  payload: WorkerProgressPayload
}

export interface SuccessMessage {
  type: 'success'
  payload: {
    taskId: string
    files: WorkerResultFile[]
  }
}

export interface ErrorMessage {
  type: 'error'
  payload: {
    taskId: string
    message: string
  }
}

export interface CanceledMessage {
  type: 'canceled'
  payload: {
    taskId: string
  }
}

export type WorkerRequest = StartProcessRequest | CancelProcessRequest
export type WorkerResponse =
  | ProgressMessage
  | SuccessMessage
  | ErrorMessage
  | CanceledMessage
