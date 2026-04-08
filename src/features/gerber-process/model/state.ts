import { DEFAULT_PROCESS_COUNT } from '../../../shared/constants/process.ts'
import type { ProgressState } from './types.ts'

export const DEFAULT_COUNT = DEFAULT_PROCESS_COUNT

export function createEmptyProgress(): ProgressState {
  return {
    phase: 'preparing',
    percent: 0,
    current: 0,
    total: 0,
    message: '等待开始',
  }
}
