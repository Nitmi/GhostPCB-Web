import { hashSeed } from '../../../core/random/rng.ts'
import type { DownloadableResult, ProgressState } from '../model/types.ts'
import type {
  CancelProcessRequest,
  StartProcessRequest,
  WorkerResponse,
} from '../../../worker/protocol.ts'

interface CreateGerberProcessTaskOptions {
  file: File
  count: number
  onProgress?: (progress: ProgressState) => void
}

interface GerberProcessTask {
  promise: Promise<DownloadableResult[]>
  cancel: () => void
}

function createProcessWorker() {
  return new Worker(new URL('../../../worker/processGerber.worker.ts', import.meta.url), {
    type: 'module',
  })
}

export function getProcessErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '处理失败，请重试。'
}

export function createGerberProcessTask(
  options: CreateGerberProcessTaskOptions,
): GerberProcessTask {
  const worker = createProcessWorker()
  const taskId = crypto.randomUUID()
  let settled = false
  let canceled = false
  let rejectPromise: ((reason?: unknown) => void) | null = null

  const promise = options.file.arrayBuffer().then(
    (fileBuffer) =>
      new Promise<DownloadableResult[]>((resolve, reject) => {
        rejectPromise = reject

        if (canceled) {
          settled = true
          reject(new Error('任务已取消。'))
          return
        }

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const message = event.data

          if ('payload' in message && message.payload.taskId !== taskId) {
            return
          }

          if (message.type === 'progress') {
            options.onProgress?.({
              phase: message.payload.phase,
              percent: message.payload.percent,
              current: message.payload.current,
              total: message.payload.total,
              message: message.payload.message,
            })
            return
          }

          settled = true
          worker.terminate()

          if (message.type === 'success') {
            resolve(
              message.payload.files.map((file) => ({
                fileName: file.fileName,
                buffer: file.buffer,
                size: file.size,
              })),
            )
            return
          }

          if (message.type === 'canceled') {
            reject(new Error('任务已取消。'))
            return
          }

          reject(new Error(message.payload.message))
        }

        worker.onerror = () => {
          if (!settled) {
            settled = true
            worker.terminate()
            reject(new Error('Worker 执行失败，请重试。'))
          }
        }

        const request: StartProcessRequest = {
          type: 'start',
          payload: {
            taskId,
            fileName: options.file.name,
            count: options.count,
            seed: hashSeed(`${options.file.name}:${options.file.size}:${Date.now()}`),
            fileBuffer,
          },
        }

        worker.postMessage(request, [fileBuffer])
      }),
  )

  return {
    promise,
    cancel() {
      if (settled || canceled) {
        return
      }

      canceled = true
      const request: CancelProcessRequest = {
        type: 'cancel',
        payload: { taskId },
      }
      worker.postMessage(request)
      worker.terminate()
      rejectPromise?.(new Error('任务已取消。'))
    },
  }
}
