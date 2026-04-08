import { generateGerberOutputs } from '../core/gerber/processor.ts'
import type { WorkerRequest, WorkerResponse } from './protocol.ts'

const CANCELED_SENTINEL = '__ghostpcb_canceled__'
const canceledTaskIds = new Set<string>()

function postWorkerMessage(message: WorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(message, transfer)
}

export function handleWorkerRequest(message: WorkerRequest) {
  if (message.type === 'cancel') {
    canceledTaskIds.add(message.payload.taskId)
    return
  }

  const { count, fileBuffer, fileName, seed, taskId } = message.payload

  try {
    const outputs = generateGerberOutputs({
      archive: new Uint8Array(fileBuffer),
      count,
      now: new Date(),
      seed,
      sourceName: fileName,
      onProgress(progress) {
        postWorkerMessage({
          type: 'progress',
          payload: {
            taskId,
            ...progress,
          },
        })
      },
      throwIfCanceled() {
        if (canceledTaskIds.has(taskId)) {
          throw new Error(CANCELED_SENTINEL)
        }
      },
    })

    const files = outputs.map((output) => {
      const buffer = output.data.slice().buffer
      return {
        fileName: output.fileName,
        buffer,
        size: buffer.byteLength,
      }
    })

    postWorkerMessage(
      {
        type: 'success',
        payload: {
          taskId,
          files,
        },
      },
      files.map((file) => file.buffer),
    )
  } catch (error) {
    if (error instanceof Error && error.message === CANCELED_SENTINEL) {
      postWorkerMessage({
        type: 'canceled',
        payload: {
          taskId,
        },
      })
    } else {
      postWorkerMessage({
        type: 'error',
        payload: {
          taskId,
          message: error instanceof Error ? error.message : '处理失败，请重试。',
        },
      })
    }
  } finally {
    canceledTaskIds.delete(taskId)
  }
}
