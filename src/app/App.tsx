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
      <section className="hero-stage">
        <div className="hero-noise" aria-hidden="true" />
        <div className="hero-orb hero-orb-left" aria-hidden="true" />
        <div className="hero-orb hero-orb-right" aria-hidden="true" />

        <header className="hero-nav">
          <div className="brand-lockup">
            <span className="brand-mark">G</span>
            <div>
              <strong>GhostPCB</strong>
              <span>Web Local Engine</span>
            </div>
          </div>
          <div className="hero-nav-meta">Privacy-first gerber processing</div>
        </header>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">GhostPCB Web</p>
            <h1>让 Gerber 处理像一台精密设备，而不是一个普通网页。</h1>
            <p className="hero-text">
              在浏览器里完成 ZIP 解包、丝印扰动、EasyEDA 风格头注入与 LCEDA
              签名注入。文件不出本地，整个过程交给独立 Worker 静默完成。
            </p>

            <div className="hero-actions">
              <a className="primary-button" href="#workspace">
                打开工作台
              </a>
              <div className="hero-note">
                <span>Local only</span>
                <span>Worker driven</span>
                <span>ZIP out</span>
              </div>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="device-shell">
              <div className="device-camera" />
              <div className="device-screen">
                <div className="device-screen-top">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="device-metrics">
                  <div>
                    <label>Execution</label>
                    <strong>Browser Native</strong>
                  </div>
                  <div>
                    <label>Pipeline</label>
                    <strong>ZIP → Parse → Shift → Pack</strong>
                  </div>
                </div>
                <div className="device-waveform">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="device-footer">
                  <p>Silkscreen shift</p>
                  <p>Header inject</p>
                  <p>Signature stamp</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="support-band">
        <div>
          <span>隐私</span>
          <p>输入文件不会上传服务器，适合敏感 PCB 工程直接在本地处理。</p>
        </div>
        <div>
          <span>一致性</span>
          <p>首期只保留当前真实启用的策略，避免无意义的历史功能堆叠。</p>
        </div>
        <div>
          <span>性能</span>
          <p>ZIP 解包与批量文本处理都在 Worker 中执行，主线程保持可交互。</p>
        </div>
      </section>

      <section id="workspace" className="workspace-section">
        <div className="section-heading">
          <p className="eyebrow">Workspace</p>
          <h2>本地处理工作台</h2>
          <p>
            上传一个 Gerber ZIP，设置输出数量，然后直接在浏览器内生成可下载的结果包。
          </p>
        </div>

        <div className="workspace-grid">
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
        </div>
      </section>

      <section className="detail-stage">
        <div className="detail-copy">
          <p className="eyebrow">Pipeline</p>
          <h2>单一职责的结构，让首期可交付，也让后续迁移到 WASM 更平滑。</h2>
          <p>
            UI 只负责输入、状态和下载，算法链路放在 `core`，重任务进入 Worker。
            这让当前版本足够快，也为未来替换底层实现预留了干净边界。
          </p>
        </div>
        <div className="detail-list">
          <div>
            <strong>01</strong>
            <p>识别 Gerber 类型，保留未知文件</p>
          </div>
          <div>
            <strong>02</strong>
            <p>按 EasyEDA 来源决定是否注入伪装头</p>
          </div>
          <div>
            <strong>03</strong>
            <p>仅对丝印层做统一轻微偏移，不改 I/J</p>
          </div>
          <div>
            <strong>04</strong>
            <p>重写并插入未使用的 LCEDA 风格签名 ADD</p>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">Ready</p>
        <h2>本地处理，立即得到结果 ZIP。</h2>
        <p>没有后端，没有队列，没有上传等待，只有浏览器里的完整处理链路。</p>
        <a className="secondary-button" href="#workspace">
          现在开始
        </a>
      </section>
    </main>
  )
}

export default App
