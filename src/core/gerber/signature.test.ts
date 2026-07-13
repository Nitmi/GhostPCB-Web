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

const EASYEDA_CARRIER_SAMPLE = `G04 Layer: TopLayer*
G04 EasyEDA Pro v3.2.131, 2026-05-06 23:14:15*
G04 Gerber Generator version 0.3*
%FSLAX45Y45*%
%MOMM*%
%ADD10C,0.2032*%
%ADD11C,1.20508*%
%ADD19C,1.5152*%
D10*
X001000Y002000D03*
M02*`

const COMPLEX_CARRIER_SAMPLE = `%FSLAX45Y45*%
%MOMM*%
%ADD10C,0.2032*%
%ADD11R,1.2049X0.8000*%
D10*
X001000Y002000D03*
M02*`

describe('injectLcedaSignature', () => {
  it('在没有现成载体时追加新的签名 ADD', () => {
    const result = injectLcedaSignature(COPPER_SAMPLE, createRng(3))

    expect(result).toContain('%ADD11C,0.200*%')
    expect(result).toMatch(/%ADD12C,0\.\d{4}\*%/)
    expect(result).toContain('D10*')
  })

  it('新版 EasyEDA 圆形载体会改为插入新的签名 ADD 并顺延编号', () => {
    const result = injectLcedaSignature(EASYEDA_CARRIER_SAMPLE, createRng(5))

    expect(result).toContain('%ADD19C,1.5152*%')
    expect(result).toMatch(/%ADD20C,0\.\d{4}\*%/)
    expect(result).not.toMatch(/%ADD21C,0\.\d{4}\*%/)
  })

  it('兼容复杂光圈首参数作为现有有效载体的格式', () => {
    const result = injectLcedaSignature(COMPLEX_CARRIER_SAMPLE, createRng(7))

    expect(result).toContain('%ADD11R,1.2049X0.8000*%')
    expect(result).not.toMatch(/%ADD12C,0\.\d{4}\*%/)
  })
})
