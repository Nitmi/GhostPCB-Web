import type { ProgressState } from "../model/types.ts";

interface ProgressBarProps {
  progress: ProgressState;
  notice: string | null;
}

export function ProgressBar(props: ProgressBarProps) {
  const { progress, notice } = props;

  return (
    <section className="panel panel-dark progress-panel">
      <div className="panel-head">
        <div>
          <h2>处理进度</h2>
        </div>
      </div>

      <div className="progress-shell">
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="progress-meta">
          <span>{progress.message}</span>
          <span>
            {progress.current}/{progress.total || 0}
          </span>
        </div>

        {notice ? (
          <div className="progress-notice" data-tone="neutral">
            {notice}
          </div>
        ) : null}
      </div>
    </section>
  );
}
