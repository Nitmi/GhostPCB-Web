/// <reference lib="webworker" />

import { handleWorkerRequest } from './handlers.ts'
import type { WorkerRequest } from './protocol.ts'

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  handleWorkerRequest(event.data)
}

export {}
