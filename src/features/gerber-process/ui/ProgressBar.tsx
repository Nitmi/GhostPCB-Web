import type { ProgressState } from '../model/types.ts'

interface ProgressBarProps {
  progress: ProgressState
  active: boolean
}

export function ProgressBar(props: ProgressBarProps) {
  const { progress, active } = props

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>处理进度</h2>
          <p>ZIP 解包、Gerber 处理和重打包都在 Worker 中执行，主线程只负责展示状态。</p>
        </div>
        <span className="muted-chip">{active ? `${progress.percent}%` : 'Idle'}</span>
      </div>

      <div className="progress-shell">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
        </div>
        <div className="progress-meta">
          <span>{progress.message}</span>
          <span>
            {progress.current}/{progress.total || 0}
          </span>
        </div>
      </div>
    </section>
  )
}
