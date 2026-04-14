import { describe, expect, it } from 'vitest'
import { detectEasyEdaSource } from './detectEasyEda.ts'
import { detectGerberFileType, getLayerDisplayName } from './fileTypes.ts'

describe('detectGerberFileType', () => {
  it('识别常见 Gerber 扩展名', () => {
    expect(detectGerberFileType('board.GTL')).toBe('top-copper')
    expect(detectGerberFileType('board.GBO')).toBe('bottom-silkscreen')
    expect(detectGerberFileType('board.DRL')).toBe('drill')
    expect(detectGerberFileType('inner.G3')).toBe('inner-layer')
    expect(detectGerberFileType('drawing.GDD')).toBe('inner-layer')
    expect(detectGerberFileType('doc.GDL')).toBe('inner-layer')
    expect(detectGerberFileType('notes.txt')).toBe('unknown')
  })

  it('生成对应层名', () => {
    expect(getLayerDisplayName('board.GTL', 'top-copper')).toBe('Top Layer')
    expect(getLayerDisplayName('inner.G4', 'inner-layer')).toBe('Inner Layer 4')
  })
})

describe('detectEasyEdaSource', () => {
  it('仅基于非钻孔 Gerber 内容判断 EasyEDA 来源', () => {
    expect(
      detectEasyEdaSource([
        {
          name: 'board.GTL',
          type: 'top-copper',
          content: 'G04 EasyEDA Pro v3.2.91*',
        },
      ]),
    ).toBe(true)

    expect(
      detectEasyEdaSource([
        {
          name: 'board.DRL',
          type: 'drill',
          content: 'EasyEDA Pro',
        },
      ]),
    ).toBe(false)
  })
})
