import { describe, expect, it } from 'vitest'
import { createRng } from '../../random/rng.ts'
import { applySilkscreenShift } from './silkscreen.ts'

const SILK_SAMPLE = `%FSLAX24Y24*%
%MOMM*%
%ADD10C,0.100*%
D10*
X001000Y002000D02*
X001500Y002500I000100J000200D01*
G04 keep comment*
M02*`

describe('applySilkscreenShift', () => {
  it('对丝印坐标做整层统一偏移，且不改 I/J', () => {
    const shifted = applySilkscreenShift(SILK_SAMPLE, createRng(7))
    const lines = shifted.split('\n')
    const [firstMoved, secondMoved] = lines.filter((line) => /D0[12]\*$/.test(line))

    const firstMatch = firstMoved.match(/X(\d+)Y(\d+)/)
    const secondMatch = secondMoved.match(/X(\d+)Y(\d+)I(\d+)J(\d+)/)

    expect(firstMatch).not.toBeNull()
    expect(secondMatch).not.toBeNull()

    const xDelta1 = Number(firstMatch?.[1]) - 1000
    const yDelta1 = Number(firstMatch?.[2]) - 2000
    const xDelta2 = Number(secondMatch?.[1]) - 1500
    const yDelta2 = Number(secondMatch?.[2]) - 2500

    expect(xDelta1).toBeGreaterThan(0)
    expect(yDelta1).toBeGreaterThan(0)
    expect(xDelta1).toBe(xDelta2)
    expect(yDelta1).toBe(yDelta2)
    expect(secondMatch?.[3]).toBe('000100')
    expect(secondMatch?.[4]).toBe('000200')
    expect(shifted).toContain('G04 keep comment*')
  })
})
