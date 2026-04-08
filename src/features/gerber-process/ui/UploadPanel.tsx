import { useId, useState, type ChangeEvent, type DragEvent } from "react";
import { formatBytes } from "../../../shared/utils/format.ts";

interface UploadPanelProps {
  selectedFile: File | null;
  disabled: boolean;
  onFileSelected: (file: File | null) => void;
  onClearFile: () => void;
}

export function UploadPanel(props: UploadPanelProps) {
  const { selectedFile, disabled, onFileSelected, onClearFile } = props;
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onFileSelected(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);

    if (disabled) {
      return;
    }

    const file = event.dataTransfer.files?.[0] ?? null;
    onFileSelected(file);
  };

  return (
    <section className="panel panel-strong upload-panel">
      <input
        id={inputId}
        className="sr-only-input"
        type="file"
        accept=".zip"
        disabled={disabled}
        onChange={handleInputChange}
      />

      <div className="panel-head">
        <div>
          <h2>输入 Gerber</h2>
          <p>仅支持一次处理一个 Gerber 压缩包，文件只会在本地浏览器内处理。</p>
        </div>
        <span className="muted-chip">Local Only</span>
      </div>

      {!selectedFile ? (
        <label
          className="upload-dropzone"
          htmlFor={inputId}
          data-dragging={dragging}
          data-disabled={disabled}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) {
              setDragging(true);
            }
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="upload-icon">ZIP</div>
          <div className="upload-copy">
            <strong>拖入 Gerber</strong>
            <p>或点击选择文件</p>
          </div>
        </label>
      ) : null}

      {selectedFile ? (
        <div className="upload-selected">
          <div className="upload-selected-head">
            <img className="upload-selected-icon" src="/icon.png" alt="" />
            <div>
              <strong>{selectedFile.name}</strong>
              <div className="file-meta">{formatBytes(selectedFile.size)}</div>
            </div>
          </div>
          <div className="upload-actions">
            <label className="ghost-button" htmlFor={inputId}>
              重新选择
            </label>
            <button
              type="button"
              className="ghost-button"
              onClick={onClearFile}
              disabled={disabled}
            >
              清除文件
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
