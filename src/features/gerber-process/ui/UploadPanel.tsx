import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
} from "react";
import { formatBytes } from "../../../shared/utils/format.ts";

interface UploadPanelProps {
  selectedFile: File | null;
  disabled: boolean;
  onFileSelected: (file: File | null) => void;
  onClearFile: () => void;
}

export function UploadPanel(props: UploadPanelProps) {
  const { selectedFile, disabled, onFileSelected, onClearFile } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onFileSelected(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    if (disabled) {
      return;
    }

    const file = event.dataTransfer.files?.[0] ?? null;
    onFileSelected(file);
  };

  const openFilePicker = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClearFile();
  };

  return (
    <section className="panel panel-strong upload-panel">
      <input
        ref={inputRef}
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

      <div
        className="upload-dropzone"
        role="button"
        tabIndex={disabled ? -1 : 0}
        data-dragging={dragging}
        data-disabled={disabled}
        data-selected={Boolean(selectedFile)}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <button
            type="button"
            className="upload-clear-button"
            onClick={handleClear}
            disabled={disabled}
            aria-label="清除已选文件"
          >
            ×
          </button>
        ) : null}

        {!selectedFile ? (
          <>
            <div className="upload-icon">ZIP</div>
            <div className="upload-copy">
              <strong>拖入 Gerber</strong>
              <p>或点击选择文件</p>
            </div>
          </>
        ) : (
          <>
            <img className="upload-selected-icon" src="/icon.png" alt="" />
            <div className="upload-copy upload-selected-copy">
              <strong>{selectedFile.name}</strong>
              <p>{formatBytes(selectedFile.size)}</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
