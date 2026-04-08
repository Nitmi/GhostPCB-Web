import { formatBytes } from '../../../shared/utils/format.ts'
import type { DownloadableResult, ProcessStatus } from '../model/types.ts'

interface ResultPanelProps {
  status: ProcessStatus
  error: string | null
  results: DownloadableResult[]
  onDownloadAll: () => void
  onDownloadOne: (result: DownloadableResult) => void
}

export function ResultPanel(props: ResultPanelProps) {
  const { status, error, results, onDownloadAll, onDownloadOne } = props

  return (
    <section className="panel panel-dark result-panel">
      <div className="panel-head">
        <div>
          <h2>输出结果</h2>
          <p>生成完成后可逐个下载，也可以一次性触发全部 ZIP 下载。</p>
        </div>
        <div className="result-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={results.length === 0}
            onClick={onDownloadAll}
          >
            全部下载
          </button>
        </div>
      </div>

      {error ? (
        <div className="status-banner" data-tone="error">
          {error}
        </div>
      ) : null}

      {!error && results.length === 0 ? (
        <div className="status-banner" data-tone="neutral">
          {status === 'running' ? '正在等待结果返回。' : '尚未生成结果。'}
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="result-list" style={{ marginTop: 18 }}>
          {results.map((result) => (
            <article key={result.fileName} className="result-item">
              <div>
                <strong>{result.fileName}</strong>
                <div className="result-meta">{formatBytes(result.size)}</div>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => onDownloadOne(result)}
              >
                下载 ZIP
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
