import { describe, expect, it } from 'vitest'
import { createRng } from '../random/rng.ts'
import { injectLcedaSignature } from './signature.ts'

const COPPER_SAMPLE = `%FSLAX24Y24*%
%MOMM*%
%ADD10C,0.100*%
%ADD11C,0.200*%
D10*
X001000Y002000D03*
M02*`

describe('injectLcedaSignature', () => {
  it('移除未使用 ADD 并插入一条新的签名 ADD', () => {
    const result = injectLcedaSignature(COPPER_SAMPLE, createRng(3))

    expect(result).not.toContain('%ADD11C,0.200*%')
    expect(result).toContain('%ADD11C,0.100*%')
    expect(result).toMatch(/%ADD10C,0\.\d{2}\*%/)
  })
})
