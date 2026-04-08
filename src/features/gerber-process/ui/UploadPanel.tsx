import { useId, useState, type ChangeEvent, type DragEvent } from 'react'
import { formatBytes } from '../../../shared/utils/format.ts'

interface UploadPanelProps {
  selectedFile: File | null
  disabled: boolean
  onFileSelected: (file: File | null) => void
  onClearFile: () => void
}

export function UploadPanel(props: UploadPanelProps) {
  const { selectedFile, disabled, onFileSelected, onClearFile } = props
  const inputId = useId()
  const [dragging, setDragging] = useState(false)

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    onFileSelected(file)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)

    if (disabled) {
      return
    }

    const file = event.dataTransfer.files?.[0] ?? null
    onFileSelected(file)
  }

  return (
    <section className="panel panel-strong upload-panel">
      <div className="panel-head">
        <div>
          <h2>输入 ZIP</h2>
          <p>点击或拖拽 Gerber ZIP 到下方区域，文件只会在本地浏览器内处理。</p>
        </div>
        <span className="muted-chip">Local Only</span>
      </div>

      <label
        className="upload-dropzone"
        htmlFor={inputId}
        data-dragging={dragging}
        data-disabled={disabled}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) {
            setDragging(true)
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          id={inputId}
          type="file"
          accept=".zip"
          disabled={disabled}
          onChange={handleInputChange}
        />
        <div className="upload-icon">ZIP</div>
        <div>
          <strong>拖入 Gerber ZIP</strong>
          <p>或点击这里选择文件</p>
        </div>
      </label>

      {selectedFile ? (
        <div className="file-card" style={{ marginTop: 18 }}>
          <strong>{selectedFile.name}</strong>
          <div className="file-meta">{formatBytes(selectedFile.size)}</div>
          <div className="upload-actions" style={{ marginTop: 14 }}>
            <button type="button" className="ghost-button" onClick={onClearFile} disabled={disabled}>
              清除文件
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
