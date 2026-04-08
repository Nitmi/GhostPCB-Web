import { normalizeLineEndings } from '../../../shared/utils/text.ts'
import type { SeededRandom } from '../../random/rng.ts'

const FORMAT_PATTERN = /%FSLAX(\d)(\d)Y(\d)(\d)\*%/

function convertShiftToRaw(mmValue: number, decimals: number, isInch: boolean): number {
  const normalizedValue = isInch ? mmValue / 25.4 : mmValue
  const raw = Math.round(normalizedValue * 10 ** decimals)
  return raw === 0 ? 1 : raw
}

function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim()

  if (
    trimmed.length === 0 ||
    trimmed.startsWith('%') ||
    trimmed.startsWith('G04') ||
    trimmed.startsWith('M') ||
    trimmed === 'G36*' ||
    trimmed === 'G37*' ||
    trimmed === 'G75*'
  ) {
    return true
  }

  return false
}

function shouldShiftLine(line: string): boolean {
  return /D0[123]\*?\s*$/.test(line) && /[XY][+-]?\d+/.test(line)
}

function shiftCoordinateValue(value: string, delta: number): string {
  const width = value.replace(/^[+-]/, '').length
  const nextValue = Number(value) + delta
  const sign = nextValue < 0 ? '-' : ''
  const digits = Math.abs(nextValue).toString().padStart(width, '0')
  return `${sign}${digits}`
}

export function applySilkscreenShift(content: string, rng: SeededRandom): string {
  const normalized = normalizeLineEndings(content)
  const formatMatch = normalized.match(FORMAT_PATTERN)

  if (!formatMatch) {
    return normalized
  }

  const xDecimals = Number(formatMatch[2])
  const yDecimals = Number(formatMatch[4])
  const isInch = normalized.includes('%MOIN*%')
  const shiftX = convertShiftToRaw(rng.range(0.01, 0.03), xDecimals, isInch)
  const shiftY = convertShiftToRaw(rng.range(0.01, 0.03), yDecimals, isInch)

  return normalized
    .split('\n')
    .map((line) => {
      if (shouldSkipLine(line) || !shouldShiftLine(line)) {
        return line
      }

      return line.replace(/([XY])([+-]?\d+)/g, (_, axis: string, value: string) => {
        const delta = axis === 'X' ? shiftX : shiftY
        return `${axis}${shiftCoordinateValue(value, delta)}`
      })
    })
    .join('\n')
}
