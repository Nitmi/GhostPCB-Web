import { describe, expect, it } from 'vitest'
import { decodeTextFile } from '../../shared/utils/text.ts'
import { zipArchive } from '../zip/zip.ts'
import { unzipArchive } from '../zip/unzip.ts'
import { generateGerberOutputs } from './processor.ts'

const TOP_SILK = `%FSLAX24Y24*%
%MOMM*%
%ADD10C,0.100*%
D10*
X001000Y002000D02*
X001500Y002500I000100J000200D01*
M02*`

const TOP_COPPER = `%FSLAX24Y24*%
%MOMM*%
%ADD10C,0.150*%
D10*
X010000Y010000D03*
M02*`

const DRILL = `M48
;DRILL FILE
M30`

function readEntryText(entries: ReturnType<typeof unzipArchive>, fileName: string): string {
  const entry = entries.find((item) => item.name === fileName)
  if (!entry) {
    throw new Error(`Missing entry: ${fileName}`)
  }

  return decodeTextFile(entry.data, fileName)
}

describe('generateGerberOutputs', () => {
  it('从 ZIP 输入生成多个独立结果 ZIP', () => {
    const archive = zipArchive([
      { name: 'board.GTO', data: new TextEncoder().encode(TOP_SILK) },
      { name: 'board.GTL', data: new TextEncoder().encode(TOP_COPPER) },
      { name: 'board.DRL', data: new TextEncoder().encode(DRILL) },
      { name: 'notes.txt', data: new TextEncoder().encode('keep me') },
    ])

    const outputs = generateGerberOutputs({
      archive,
      count: 2,
      now: new Date(2026, 3, 8, 12, 0, 0),
      seed: 42,
      sourceName: 'board.zip',
    })

    expect(outputs).toHaveLength(2)
    expect(outputs[0]?.fileName).toMatch(/^Gerber_PCB1_\d{4}-\d{2}-\d{2}\.zip$/)
    expect(outputs[1]?.fileName).toMatch(/^Gerber_PCB2_\d{4}-\d{2}-\d{2}\.zip$/)

    const firstArchive = unzipArchive(outputs[0].data)
    const secondArchive = unzipArchive(outputs[1].data)

    const firstSilk = readEntryText(firstArchive, 'board.GTO')
    const secondSilk = readEntryText(secondArchive, 'board.GTO')
    const firstCopper = readEntryText(firstArchive, 'board.GTL')
    const firstDrill = readEntryText(firstArchive, 'board.DRL')
    const firstNotes = readEntryText(firstArchive, 'notes.txt')

    expect(firstSilk).toContain('G04 Layer: Top Silk Layer*')
    expect(firstSilk).toContain('I000100J000200')
    expect(firstSilk).not.toContain('X001000Y002000D02*')
    expect(firstCopper).toContain('G04 Layer: Top Layer*')
    expect(firstCopper).toMatch(/%ADD10C,0\.\d{2}\*%/)
    expect(firstDrill).toBe(DRILL)
    expect(firstNotes).toBe('keep me')
    expect(firstSilk).not.toBe(secondSilk)
  })

  it('对没有有效 Gerber 文件的 ZIP 报错', () => {
    const archive = zipArchive([{ name: 'notes.txt', data: new TextEncoder().encode('no gerber') }])

    expect(() =>
      generateGerberOutputs({
        archive,
        count: 1,
        now: new Date(2026, 3, 8, 12, 0, 0),
        seed: 9,
        sourceName: 'notes.zip',
      }),
    ).toThrow('ZIP 中没有有效的 Gerber 文件。')
  })
})
