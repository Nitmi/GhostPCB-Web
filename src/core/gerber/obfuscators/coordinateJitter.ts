import { normalizeLineEndings } from '../../../shared/utils/text.ts'
import type { SeededRandom } from '../../random/rng.ts'

const FORMAT_PATTERN = /%FSLAX(\d)(\d)Y(\d)(\d)\*%/

function parseFormat(content: string): { xDecimals: number; yDecimals: number; isInch: boolean } | null {
  const match = content.match(FORMAT_PATTERN)
  if (!match) {
    return null
  }

  return {
    xDecimals: Number(match[2]),
    yDecimals: Number(match[4]),
    isInch: content.includes('%MOIN*%'),
  }
}

function convertMmToRaw(mm: number, decimals: number, isInch: boolean): number {
  return Math.round((isInch ? mm / 25.4 : mm) * 10 ** decimals)
}

function jitterCoordinateLine(
  line: string,
  xDecimals: number,
  yDecimals: number,
  isInch: boolean,
  rng: SeededRandom,
  maxOffsetMm: number,
): string {
  return line.replace(/([XY])([+-]?\d+)/g, (_, axis: string, value: string) => {
    const decimals = axis === 'X' ? xDecimals : yDecimals
    const rawDelta = rng.integer(
      -convertMmToRaw(maxOffsetMm, decimals, isInch),
      convertMmToRaw(maxOffsetMm, decimals, isInch),
    )

    if (rawDelta === 0) {
      return `${axis}${value}`
    }

    const width = value.replace(/^[+-]/, '').length
    const nextValue = Number(value) + rawDelta
    const sign = nextValue < 0 ? '-' : ''
    const digits = Math.abs(Math.round(nextValue)).toString().padStart(width, '0')
    return `${axis}${sign}${digits}`
  })
}

function shouldJitterLine(line: string): boolean {
  const trimmed = line.trim()

  if (
    trimmed.length === 0 ||
    trimmed.startsWith('%') ||
    trimmed.startsWith('G04') ||
    trimmed.startsWith('M') ||
    trimmed.startsWith('G36') ||
    trimmed.startsWith('G37') ||
    trimmed.startsWith('G75')
  ) {
    return false
  }

  return /[XY][+-]?\d+/.test(line)
}

export function applyCoordinateJitter(
  content: string,
  rng: SeededRandom,
  maxOffsetMm: number,
): string {
  const normalized = normalizeLineEndings(content)
  const fmt = parseFormat(normalized)

  if (!fmt) {
    return normalized
  }

  return normalized
    .split('\n')
    .map((line) => {
      if (!shouldJitterLine(line)) {
        return line
      }

      return jitterCoordinateLine(line, fmt.xDecimals, fmt.yDecimals, fmt.isInch, rng, maxOffsetMm)
    })
    .join('\n')
}
