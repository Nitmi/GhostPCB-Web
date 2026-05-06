import type { ProcessPhase } from '../../shared/constants/process.ts'
import { stripZipExtension } from '../../shared/utils/format.ts'
import { hashSeed, mixSeed } from '../random/rng.ts'
import { detectGerberFileType, isKnownGerberType } from './fileTypes.ts'
import { runGerberPipeline } from './pipeline.ts'
import { unzipArchive } from '../zip/unzip.ts'
import { zipArchive } from '../zip/zip.ts'

export interface ProcessingProgress {
  phase: ProcessPhase
  percent: number
  current: number
  total: number
  message: string
}

export interface GeneratedArchiveResult {
  fileName: string
  data: Uint8Array
}

export interface GenerateGerberOutputsOptions {
  archive: Uint8Array
  count: number
  now: Date
  seed: number
  sourceName: string
  onProgress?: (progress: ProcessingProgress) => void
  throwIfCanceled?: () => void
}

function emitProgress(
  onProgress: GenerateGerberOutputsOptions['onProgress'],
  progress: ProcessingProgress,
) {
  onProgress?.(progress)
}

export function generateGerberOutputs(
  options: GenerateGerberOutputsOptions,
): GeneratedArchiveResult[] {
  const {
    archive,
    count,
    now,
    seed,
    sourceName,
    onProgress,
    throwIfCanceled,
  } = options
  const safeCount = Math.max(1, Math.min(99, Math.round(count)))

  emitProgress(onProgress, {
    phase: 'preparing',
    percent: 4,
    current: 0,
    total: safeCount,
    message: '正在解压 ZIP',
  })

  const sourceEntries = unzipArchive(archive)
  const hasKnownGerber = sourceEntries.some((entry) =>
    isKnownGerberType(detectGerberFileType(entry.name)),
  )

  if (!hasKnownGerber) {
    throw new Error('ZIP 中没有有效的 Gerber 文件。')
  }

  const outputs: GeneratedArchiveResult[] = []
  const baseSeed = mixSeed(seed, hashSeed(sourceName))
  const outputBaseName = stripZipExtension(sourceName)

  for (let index = 0; index < safeCount; index += 1) {
    throwIfCanceled?.()

    const current = index + 1
    const iterationSeed = mixSeed(baseSeed, current)
    const processingPercent = 10 + Math.floor((index / safeCount) * 72)

    emitProgress(onProgress, {
      phase: 'processing',
      percent: processingPercent,
      current,
      total: safeCount,
      message: `正在处理第 ${current}/${safeCount} 个结果包`,
    })

    const processedEntries = runGerberPipeline(sourceEntries, {
      now,
      seed: iterationSeed,
      throwIfCanceled,
      onSourceFlavorDetected(flavor) {
        if (flavor !== 'altium-designer') {
          return
        }

        emitProgress(onProgress, {
          phase: 'analyzing',
          percent: Math.min(95, processingPercent + 2),
          current,
          total: safeCount,
          message: '检测到原始 Gerber 由 Altium Designer 导出，结果产物将被伪装为立创 Gerber',
        })
      },
    })

    throwIfCanceled?.()
    emitProgress(onProgress, {
      phase: 'packaging',
      percent: Math.min(96, processingPercent + Math.ceil(72 / safeCount)),
      current,
      total: safeCount,
      message: `正在打包第 ${current}/${safeCount} 个结果包`,
    })

    outputs.push({
      fileName: `${outputBaseName}_改${current}.zip`,
      data: zipArchive(processedEntries),
    })
  }

  emitProgress(onProgress, {
    phase: 'complete',
    percent: 100,
    current: outputs.length,
    total: outputs.length,
    message: `处理完成，共生成 ${outputs.length} 个 ZIP`,
  })

  return outputs
}
