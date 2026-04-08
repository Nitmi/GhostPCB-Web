import { formatBytes } from "../../../shared/utils/format.ts";
import type { DownloadableResult, ProcessStatus } from "../model/types.ts";

interface ResultPanelProps {
  status: ProcessStatus;
  error: string | null;
  results: DownloadableResult[];
  onDownloadAll: () => void;
}

export function ResultPanel(props: ResultPanelProps) {
  const { status, error, results, onDownloadAll } = props;

  return (
    <section className="panel panel-dark result-panel">
      <div className="panel-head">
        <div>
          <h2>输出结果</h2>
          <p>生成后可逐个或全部下载</p>
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

      <div className="result-panel-content">
        {error ? (
          <div className="status-banner" data-tone="error">
            {error}
          </div>
        ) : null}

        {!error && results.length === 0 ? (
          <div className="results-empty" data-running={status === "running"}>
            <img className="results-empty-icon" src="/icon.png" alt="" />
            <strong>
              {status === "running" ? "正在准备结果包" : "尚未生成结果"}
            </strong>
            <p>
              {status === "running"
                ? "处理完成后，结果会以密集列表显示在这里。"
                : "上传 Gerber 并开始处理后，下载列表会出现在这里。"}
            </p>
          </div>
        ) : null}

        {results.length > 0 ? (
          <div
            className="finder-list"
            data-single={results.length === 1}
          >
            <div className="finder-header" aria-hidden="true">
              <span>名称</span>
              <span>大小</span>
            </div>
            <div className="finder-scroll">
              {results.map((result) => (
                <article key={result.fileName} className="finder-row">
                  <div className="finder-name">
                    <div>
                      <strong>{result.fileName}</strong>
                      <div className="result-meta">Gerber Archive</div>
                    </div>
                  </div>
                  <div className="finder-size">{formatBytes(result.size)}</div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="result-panel-footer">
        <span>ZIP 解析、文本处理、重打包均在本地离线进行。</span>
      </footer>
    </section>
  );
}
