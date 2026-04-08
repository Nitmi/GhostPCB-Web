import {
  MAX_PROCESS_COUNT,
  MIN_PROCESS_COUNT,
} from "../../../shared/constants/process.ts";

interface ProcessFormProps {
  count: number;
  disabled: boolean;
  isRunning: boolean;
  onCountChange: (value: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ProcessForm(props: ProcessFormProps) {
  const { count, disabled, isRunning, onCountChange, onSubmit, onCancel } =
    props;

  const decreaseCount = () => {
    onCountChange(Math.max(MIN_PROCESS_COUNT, count - 1));
  };

  const increaseCount = () => {
    onCountChange(Math.min(MAX_PROCESS_COUNT, count + 1));
  };

  return (
    <section className="panel panel-muted control-panel">
      <div className="panel-head">
        <div>
          <h2>处理参数</h2>
          <p>生成数量范围 1 到 99</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="field-label">
          生成数量
          <div className="stepper-input">
            <button
              type="button"
              className="stepper-button"
              onClick={decreaseCount}
              disabled={disabled || count <= MIN_PROCESS_COUNT}
              aria-label="减少生成数量"
            >
              −
            </button>
            <input
              type="number"
              min={MIN_PROCESS_COUNT}
              max={MAX_PROCESS_COUNT}
              value={count}
              onChange={(event) => onCountChange(Number(event.target.value))}
            />
            <button
              type="button"
              className="stepper-button"
              onClick={increaseCount}
              disabled={disabled || count >= MAX_PROCESS_COUNT}
              aria-label="增加生成数量"
            >
              +
            </button>
          </div>
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="primary-button"
            disabled={disabled}
            onClick={onSubmit}
          >
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
  );
}
