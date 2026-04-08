import { useEffect, useRef, useState, startTransition } from 'react'
import './app.css'
import { ProcessForm } from '../features/gerber-process/ui/ProcessForm.tsx'
import { ProgressBar } from '../features/gerber-process/ui/ProgressBar.tsx'
import { ResultPanel } from '../features/gerber-process/ui/ResultPanel.tsx'
import { UploadPanel } from '../features/gerber-process/ui/UploadPanel.tsx'
import {
  createEmptyProgress,
  DEFAULT_COUNT,
} from '../features/gerber-process/model/state.ts'
import type {
  DownloadableResult,
  ProcessStatus,
  ProgressState,
} from '../features/gerber-process/model/types.ts'
import {
  normalizeCountInput,
  validateZipFile,
} from '../features/gerber-process/model/validators.ts'
import {
  createGerberProcessTask,
  getProcessErrorMessage,
} from '../features/gerber-process/service/processClient.ts'
import {
  downloadAllResults,
  downloadResultFile,
} from '../features/gerber-process/service/download.ts'

function App() {
  const [count, setCount] = useState(DEFAULT_COUNT)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<ProcessStatus>('idle')
  const [progress, setProgress] = useState<ProgressState>(createEmptyProgress())
  const [results, setResults] = useState<DownloadableResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const taskRef = useRef<ReturnType<typeof createGerberProcessTask> | null>(null)

  useEffect(() => {
    return () => {
      taskRef.current?.cancel()
    }
  }, [])

  const applySelectedFile = (file: File | null) => {
    if (!file) {
      setSelectedFile(null)
      setResults([])
      setError(null)
      setStatus('idle')
      setProgress(createEmptyProgress())
      return
    }

    const validation = validateZipFile(file)
    if (!validation.valid) {
      setError(validation.message)
      return
    }

    setSelectedFile(file)
    setResults([])
    setError(null)
    setStatus('idle')
    setProgress(createEmptyProgress())
  }

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('请先选择一个 Gerber ZIP 文件。')
      return
    }

    const normalizedCount = normalizeCountInput(count)
    setCount(normalizedCount)
    setStatus('running')
    setError(null)
    setResults([])
    setProgress({
      phase: 'preparing',
      percent: 2,
      current: 0,
      total: normalizedCount,
      message: '正在启动本地处理任务',
    })

    const task = createGerberProcessTask({
      file: selectedFile,
      count: normalizedCount,
      onProgress: setProgress,
    })

    taskRef.current = task

    try {
      const nextResults = await task.promise
      startTransition(() => {
        setResults(nextResults)
        setStatus('success')
        setProgress({
          phase: 'complete',
          percent: 100,
          current: nextResults.length,
          total: nextResults.length,
          message: `已生成 ${nextResults.length} 个结果包`,
        })
      })
    } catch (processError) {
      setStatus('error')
      setError(getProcessErrorMessage(processError))
    } finally {
      taskRef.current = null
    }
  }

  const handleCancel = () => {
    taskRef.current?.cancel()
    taskRef.current = null
    setStatus('idle')
    setProgress(createEmptyProgress())
    setError('任务已取消。')
  }

  const isRunning = status === 'running'

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">GhostPCB Web</p>
          <h1>Gerber ZIP 本地混淆与重打包</h1>
          <p className="hero-text">
            浏览器内完成 ZIP 解包、丝印扰动、EasyEDA 风格头注入和 LCEDA
            签名注入。文件不上传，处理全程运行在本地 Worker。
          </p>
        </div>
        <dl className="hero-stats">
          <div>
            <dt>运行方式</dt>
            <dd>Pure Browser</dd>
          </div>
          <div>
            <dt>处理线程</dt>
            <dd>Web Worker</dd>
          </div>
          <div>
            <dt>输出形式</dt>
            <dd>ZIP 下载</dd>
          </div>
        </dl>
      </section>

      <section className="workspace-grid">
        <div className="stack-column">
          <UploadPanel
            selectedFile={selectedFile}
            disabled={isRunning}
            onFileSelected={applySelectedFile}
            onClearFile={() => applySelectedFile(null)}
          />
          <ProcessForm
            count={count}
            disabled={!selectedFile || isRunning}
            isRunning={isRunning}
            onCountChange={(value) => {
              setCount(value)
              setError(null)
            }}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>

        <div className="stack-column">
          <ProgressBar progress={progress} active={isRunning || status === 'success'} />
          <ResultPanel
            status={status}
            error={error}
            results={results}
            onDownloadAll={() => downloadAllResults(results)}
            onDownloadOne={(result) => downloadResultFile(result)}
          />
        </div>
      </section>
    </main>
  )
}

export default App
