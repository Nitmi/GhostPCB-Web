import {
  MAX_PROCESS_COUNT,
  MIN_PROCESS_COUNT,
} from '../../../shared/constants/process.ts'

interface ProcessFormProps {
  count: number
  disabled: boolean
  isRunning: boolean
  onCountChange: (value: number) => void
  onSubmit: () => void
  onCancel: () => void
}

export function ProcessForm(props: ProcessFormProps) {
  const { count, disabled, isRunning, onCountChange, onSubmit, onCancel } = props

  return (
    <section className="panel panel-muted control-panel">
      <div className="panel-head">
        <div>
          <h2>处理参数</h2>
          <p>生成数量范围 1 到 99。</p>
        </div>
        <span className="muted-chip">Worker Pipeline</span>
      </div>

      <div className="form-grid">
        <label className="field-label">
          生成数量
          <input
            type="number"
            min={MIN_PROCESS_COUNT}
            max={MAX_PROCESS_COUNT}
            value={count}
            onChange={(event) => onCountChange(Number(event.target.value))}
          />
        </label>
        <div className="field-hint">
          每个结果包都会重新执行完整处理。
        </div>
        <div className="form-actions">
          <button type="button" className="primary-button" disabled={disabled} onClick={onSubmit}>
            开始处理
          </button>
          <button
            type="button"
            className="ghost-button"
            disabled={!isRunning}
            onClick={onCancel}
          >
            取消任务
          </button>
        </div>
      </div>
    </section>
  )
}
