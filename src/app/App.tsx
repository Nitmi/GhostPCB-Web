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
  const outputCount = results.length
  const fileLabel = selectedFile ? selectedFile.name : '未选择 ZIP'
  const statusLabel =
    status === 'running'
      ? '处理中'
      : status === 'success'
        ? '已完成'
        : status === 'error'
          ? '异常'
          : '待开始'

  return (
    <main className="app-shell">
      <section className="app-window">
        <div className="surface-noise" aria-hidden="true" />

        <header className="window-chrome">
          <div className="window-app">
            <img className="window-app-icon" src="/icon.png" alt="" />
            <div className="window-app-copy">
              <strong>GhostPCB</strong>
              <span>Local Gerber Processor</span>
            </div>
          </div>

          <div className="window-title">
            <strong>Workspace</strong>
            <span>Gerber ZIP Obfuscation Tool</span>
          </div>

          <div className="window-toolbar">
            <span className="window-chip">Local</span>
            <span className="window-chip">Worker</span>
            <span className="window-chip">{statusLabel}</span>
          </div>
        </header>

        <section id="workspace" className="workspace-body">
          <aside className="workspace-sidebar">
            <div className="sidebar-head">
              <p className="eyebrow">Tool Workspace</p>
              <div className="brand-lockup">
                <span className="brand-mark">G</span>
                <div>
                  <strong>GhostPCB</strong>
                  <span>Gerber ZIP 本地处理</span>
                </div>
              </div>
              <p className="sidebar-description">
                上传 ZIP，设置数量，直接生成并下载结果包。
              </p>
            </div>

            <div className="sidebar-metrics">
              <div className="metric-item">
                <span>输入文件</span>
                <strong>{fileLabel}</strong>
              </div>
              <div className="metric-item">
                <span>生成数量</span>
                <strong>{count}</strong>
              </div>
            </div>

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
          </aside>

          <section className="workspace-main">
            <div className="main-summary">
              <div className="summary-card">
                <span>状态</span>
                <strong>{statusLabel}</strong>
              </div>
              <div className="summary-card">
                <span>结果数量</span>
                <strong>{outputCount}</strong>
              </div>
              <div className="summary-card">
                <span>输出模式</span>
                <strong>ZIP Download</strong>
              </div>
            <div className="summary-card">
              <span>策略范围</span>
              <strong>Silkscreen + Header + Signature</strong>
            </div>
          </div>

            <ProgressBar progress={progress} active={isRunning || status === 'success'} />
            <ResultPanel
              status={status}
              error={error}
              results={results}
              onDownloadAll={() => downloadAllResults(results)}
              onDownloadOne={(result) => downloadResultFile(result)}
            />

            <footer className="workspace-footer">
              <span>ZIP 解析、文本处理、重打包均在 Worker 中执行。</span>
              <span>未知文件原样保留，钻孔文件不注入头和签名。</span>
            </footer>
          </section>
        </section>
      </section>
    </main>
  )
}

export default App
