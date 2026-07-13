import { describe, expect, it } from 'vitest'
import { createRng } from '../../random/rng.ts'
import { applyCoordinateJitter } from './coordinateJitter.ts'

const MM_SAMPLE = `%FSLAX24Y24*%
%MOMM*%
%ADD10C,0.100*%
D10*
X001000Y002000D02*
X001500Y002500I000100J000200D01*
M02*`

const INCH_SAMPLE = `%FSLAX24Y24*%
%MOIN*%
%ADD10C,0.100*%
D10*
X001000Y002000D02*
M02*`

const NO_FORMAT = `%ADD10C,0.100*%\nD10*\nX001000Y002000D02*\nM02*`

const COPPER_SAMPLE = `%FSLAX45Y45*%
%MOMM*%
%ADD10C,0.2032*%
D10*
X010000Y020000D03*
X030000Y040000D02*
X050000Y060000D01*
M02*`

describe('applyCoordinateJitter', () => {
  it('修改 X/Y 坐标值', () => {
    const result = applyCoordinateJitter(MM_SAMPLE, createRng(42), 0.003)
    const originalCoords = MM_SAMPLE.match(/X(\d+)Y(\d+)/g)
    const resultCoords = result.match(/X(\d+)Y(\d+)/g)

    expect(resultCoords).not.toEqual(originalCoords)
  })

  it('保留 I/J 值不变', () => {
    const result = applyCoordinateJitter(MM_SAMPLE, createRng(42), 0.003)
    expect(result).toContain('I000100J000200')
  })

  it('保留注释和命令', () => {
    const result = applyCoordinateJitter(MM_SAMPLE, createRng(42), 0.003)
    expect(result).toContain('%FSLAX24Y24*%')
    expect(result).toContain('%MOMM*%')
    expect(result).toContain('%ADD10C,0.100*%')
    expect(result).toContain('M02*')
  })

  it('无格式信息时返回原内容', () => {
    const result = applyCoordinateJitter(NO_FORMAT, createRng(42), 0.003)
    expect(result).toBe(NO_FORMAT)
  })

  it('英制下正确转换偏移量', () => {
    const result = applyCoordinateJitter(INCH_SAMPLE, createRng(42), 0.03)
    expect(result).not.toBe(INCH_SAMPLE)
    expect(result).toContain('%MOIN*%')
  })

  it('各坐标独立抖动（同一行内 XY 不同步）', () => {
    const result = applyCoordinateJitter(COPPER_SAMPLE, createRng(77), 0.003)
    const lines = result.split('\n').filter((l) => /^[XY][+-]?\d+/.test(l))
    expect(lines.length).toBeGreaterThanOrEqual(3)

    const firstLine = lines[0]?.match(/X([+-]?\d+)Y([+-]?\d+)/)
    const secondLine = lines[1]?.match(/X([+-]?\d+)Y([+-]?\d+)/)
    const thirdLine = lines[2]?.match(/X([+-]?\d+)Y([+-]?\d+)/)

    expect(firstLine).not.toBeNull()
    expect(secondLine).not.toBeNull()
    expect(thirdLine).not.toBeNull()

    const xDelta1 = Number(firstLine![1]) - 10000
    const yDelta1 = Number(firstLine![2]) - 20000
    const xDelta2 = Number(secondLine![1]) - 30000
    const yDelta2 = Number(secondLine![2]) - 40000
    const xDelta3 = Number(thirdLine![1]) - 50000
    const yDelta3 = Number(thirdLine![2]) - 60000

    const allDeltas = [xDelta1, yDelta1, xDelta2, yDelta2, xDelta3, yDelta3]
    const uniqueDeltas = new Set(allDeltas)

    expect(uniqueDeltas.size).toBeGreaterThan(1)
  })

  it('不同 seed 产生不同抖动结果', () => {
    const result1 = applyCoordinateJitter(COPPER_SAMPLE, createRng(1), 0.003)
    const result2 = applyCoordinateJitter(COPPER_SAMPLE, createRng(2), 0.003)
    expect(result1).not.toBe(result2)
  })
})
