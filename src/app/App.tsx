import { useEffect, useRef, useState, startTransition } from "react";
import "./app.css";
import { ProcessForm } from "../features/gerber-process/ui/ProcessForm.tsx";
import { ProgressBar } from "../features/gerber-process/ui/ProgressBar.tsx";
import { ResultPanel } from "../features/gerber-process/ui/ResultPanel.tsx";
import { UploadPanel } from "../features/gerber-process/ui/UploadPanel.tsx";
import {
  createEmptyProgress,
  DEFAULT_COUNT,
} from "../features/gerber-process/model/state.ts";
import type {
  DownloadableResult,
  ProcessStatus,
  ProgressState,
} from "../features/gerber-process/model/types.ts";
import {
  normalizeCountInput,
  validateZipFile,
} from "../features/gerber-process/model/validators.ts";
import {
  createGerberProcessTask,
  getProcessErrorMessage,
} from "../features/gerber-process/service/processClient.ts";
import {
  downloadAllResults,
  downloadResultFile,
} from "../features/gerber-process/service/download.ts";

function App() {
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessStatus>("idle");
  const [progress, setProgress] = useState<ProgressState>(
    createEmptyProgress(),
  );
  const [results, setResults] = useState<DownloadableResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const taskRef = useRef<ReturnType<typeof createGerberProcessTask> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      taskRef.current?.cancel();
    };
  }, []);

  const applySelectedFile = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setResults([]);
      setError(null);
      setStatus("idle");
      setProgress(createEmptyProgress());
      return;
    }

    const validation = validateZipFile(file);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setSelectedFile(file);
    setResults([]);
    setError(null);
    setStatus("idle");
    setProgress(createEmptyProgress());
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("请先选择一个 Gerber ZIP 文件。");
      return;
    }

    const normalizedCount = normalizeCountInput(count);
    setCount(normalizedCount);
    setStatus("running");
    setError(null);
    setResults([]);
    setProgress({
      phase: "preparing",
      percent: 2,
      current: 0,
      total: normalizedCount,
      message: "正在启动本地处理任务",
    });

    const task = createGerberProcessTask({
      file: selectedFile,
      count: normalizedCount,
      onProgress: setProgress,
    });

    taskRef.current = task;

    try {
      const nextResults = await task.promise;
      startTransition(() => {
        setResults(nextResults);
        setStatus("success");
        setProgress({
          phase: "complete",
          percent: 100,
          current: nextResults.length,
          total: nextResults.length,
          message: `已生成 ${nextResults.length} 个结果包`,
        });
      });
    } catch (processError) {
      setStatus("error");
      setError(getProcessErrorMessage(processError));
    } finally {
      taskRef.current = null;
    }
  };

  const handleCancel = () => {
    taskRef.current?.cancel();
    taskRef.current = null;
    setStatus("idle");
    setProgress(createEmptyProgress());
    setError("任务已取消。");
  };

  const isRunning = status === "running";
  const outputCount = results.length;
  const fileLabel = selectedFile ? selectedFile.name : "未选择 Gerber";
  const statusLabel =
    status === "running"
      ? "处理中"
      : status === "success"
        ? "已完成"
        : status === "error"
          ? "异常"
          : "待开始";

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

          <div className="window-toolbar">
            <a
              className="window-icon-link"
              href="https://github.com/Nitmi/GhostPCB-Web"
              target="_blank"
              rel="noreferrer"
              aria-label="查看 GitHub 仓库"
              title="GitHub"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.426 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.866-.013-1.7-2.782.605-3.37-1.344-3.37-1.344-.455-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.833.091-.647.349-1.088.635-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.987 1.029-2.687-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.56 9.56 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.594 1.028 2.687 0 3.848-2.339 4.695-4.566 4.943.359.31.678.922.678 1.858 0 1.34-.012 2.422-.012 2.75 0 .268.18.58.688.481A10.02 10.02 0 0 0 22 12.017C22 6.484 17.523 2 12 2Z"
                  fill="currentColor"
                />
              </svg>
            </a>
          </div>
        </header>

        <section id="workspace" className="workspace-body">
          <aside className="workspace-sidebar">
            <div className="sidebar-intro">
              <p>
                Gerber 混淆工具 Web 版，异化 Gerber 文件，但生产出来是同样的
                PCB。
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
                setCount(value);
                setError(null);
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
                <span>处理范围</span>
                <strong>Silkscreen + Header + Signature</strong>
              </div>
            </div>

            <ProgressBar
              progress={progress}
              active={isRunning || status === "success"}
            />
            <ResultPanel
              status={status}
              error={error}
              results={results}
              onDownloadAll={() => downloadAllResults(results)}
              onDownloadOne={(result) => downloadResultFile(result)}
            />
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;
