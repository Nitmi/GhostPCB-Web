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

const TOP_COPPER = `G04*
G04 #@! TF.GenerationSoftware,Altium Limited,Altium Designer,20.0.13 (296)*
G04*
G04 Layer_Color=255*
%FSLAX24Y24*%
%MOIN*%
%ADD10C,0.150*%
D10*
X010000Y010000D03*
M02*`

const INNER_LAYER = `%FSLAX45Y45*%
%MOMM*%
%ADD10C,0.2032*%
D10*
X000100Y000200D03*
M02*`

const OUTLINE = `%FSLAX45Y45*%
%MOMM*%
%ADD10C,0.2000*%
D10*
X000000Y000000D02*
X010000Y000000D01*
M02*`

const DRILL_PTH = `;TYPE=PLATED
;Layer: PTH_Through
M48
METRIC,LZ,0000.00000
T01C0.43180
%
G05
G90
T01
X1.47188Y-6.3499
M30`

const DRILL_NPTH = `;TYPE=NON_PLATED
;Layer: NPTH_Through
M48
METRIC,LZ,0000.00000
T01C1.00000
%
G05
G90
T01
X3.54118Y-9.39276
M30`

const DRILL_VIA = `;TYPE=PLATED
;Layer: PTH_Through_Via
M48
METRIC,LZ,0000.00000
T01C0.30500
%
G05
G90
T01
X7.112Y16.13395
M30`

function readEntryText(entries: ReturnType<typeof unzipArchive>, fileName: string): string {
  const entry = entries.find((item) => item.name === fileName)
  if (!entry) {
    throw new Error(`Missing entry: ${fileName}`)
  }

  return decodeTextFile(entry.data, fileName)
}

describe('generateGerberOutputs', () => {
  it('只输出标准制造文件并统一命名', () => {
    const progressMessages: string[] = []
    const archive = zipArchive([
      { name: 'Core_S3.GTO', data: new TextEncoder().encode(TOP_SILK) },
      { name: 'Core_S3.GTL', data: new TextEncoder().encode(TOP_COPPER) },
      { name: 'Core_S3.G1', data: new TextEncoder().encode(INNER_LAYER) },
      { name: 'Core_S3.GKO', data: new TextEncoder().encode(OUTLINE) },
      { name: 'Core_S3.GD1', data: new TextEncoder().encode('%FSLAX24Y24*%\nM02*') },
      { name: 'Core_S3.GM1', data: new TextEncoder().encode('%FSLAX24Y24*%\nM02*') },
      { name: 'Core_S3.TXT', data: new TextEncoder().encode(DRILL_PTH) },
      { name: 'Core_S3-NPTH.XLN', data: new TextEncoder().encode(DRILL_NPTH) },
      { name: 'Core_S3-Via.TXT', data: new TextEncoder().encode(DRILL_VIA) },
      { name: 'CAMtastic1.Cam', data: new TextEncoder().encode('skip me') },
      { name: 'FlyingProbeTesting.json', data: new TextEncoder().encode('{}') },
    ])

    const outputs = generateGerberOutputs({
      archive,
      count: 1,
      now: new Date(2026, 3, 8, 12, 0, 0),
      seed: 42,
      sourceName: 'board.zip',
      onProgress(progress) {
        progressMessages.push(progress.message)
      },
    })

    expect(outputs).toHaveLength(1)
    expect(outputs[0]?.fileName).toMatch(/^Gerber_PCB1_\d{4}-\d{2}-\d{2}\.zip$/)

    const resultArchive = unzipArchive(outputs[0].data)
    expect(resultArchive.map((entry) => entry.name)).toEqual([
      'Gerber_TopLayer.GTL',
      'Gerber_InnerLayer1.G1',
      'Gerber_TopSilkscreenLayer.GTO',
      'Gerber_BoardOutlineLayer.GKO',
      'Drill_NPTH_Through.DRL',
      'Drill_PTH_Through.DRL',
      'Drill_PTH_Through_Via.DRL',
      'PCB下单必读.txt',
      'FlyingProbeTesting.json',
    ])

    const copper = readEntryText(resultArchive, 'Gerber_TopLayer.GTL')
    const silkscreen = readEntryText(resultArchive, 'Gerber_TopSilkscreenLayer.GTO')
    const drill = readEntryText(resultArchive, 'Drill_PTH_Through.DRL')
    const orderReadme = readEntryText(resultArchive, 'PCB下单必读.txt')
    const flyingProbe = readEntryText(resultArchive, 'FlyingProbeTesting.json')

    expect(copper).toContain('G04 Layer: TopLayer*')
    expect(copper).toContain('G04 EasyEDA Pro v3.2.58, 2026-04-08 12:00:00*')
    expect(copper).not.toContain('Altium Designer')
    expect(copper).toMatch(/%ADD10C,0\.\d{4}\*%/)
    expect(progressMessages).toContain(
      '检测到原始 Gerber 由 Altium Designer 导出，结果产物将被伪装为立创 Gerber',
    )
    expect(silkscreen).toContain('G04 Layer: TopSilkscreenLayer*')
    expect(silkscreen).toContain('I000100J000200')
    expect(silkscreen).not.toContain('X001000Y002000D02*')
    expect(drill).toContain(';TYPE=PLATED')
    expect(drill).toContain('M48')
    expect(orderReadme).toContain('https://prodocs.lceda.cn/cn/pcb/order-order-pcb/index.html')
    expect(flyingProbe).toBe('{}')
  })

  it('兼容四层板输出与多钻孔文件命名', () => {
    const archive = zipArchive([
      { name: 'board.GTL', data: new TextEncoder().encode(TOP_COPPER) },
      { name: 'board.GBL', data: new TextEncoder().encode(TOP_COPPER) },
      { name: 'board.G2', data: new TextEncoder().encode(INNER_LAYER) },
      { name: 'board.G1', data: new TextEncoder().encode(INNER_LAYER) },
      { name: 'board.GTS', data: new TextEncoder().encode(OUTLINE) },
      { name: 'board.GBS', data: new TextEncoder().encode(OUTLINE) },
      { name: 'board.DRL', data: new TextEncoder().encode(DRILL_PTH) },
      { name: 'board_npth.TXT', data: new TextEncoder().encode(DRILL_NPTH) },
      { name: 'board_via.XLN', data: new TextEncoder().encode(DRILL_VIA) },
    ])

    const outputs = generateGerberOutputs({
      archive,
      count: 1,
      now: new Date(2026, 3, 8, 12, 0, 0),
      seed: 7,
      sourceName: '4layer.zip',
    })

    const resultArchive = unzipArchive(outputs[0].data)
    expect(resultArchive.map((entry) => entry.name)).toContain('Gerber_InnerLayer1.G1')
    expect(resultArchive.map((entry) => entry.name)).toContain('Gerber_InnerLayer2.G2')
    expect(resultArchive.map((entry) => entry.name)).toContain('Gerber_BottomLayer.GBL')
    expect(resultArchive.map((entry) => entry.name)).toContain('Drill_NPTH_Through.DRL')
    expect(resultArchive.map((entry) => entry.name)).toContain('Drill_PTH_Through_Via.DRL')
    expect(resultArchive.map((entry) => entry.name)).toContain('PCB下单必读.txt')
    expect(resultArchive.map((entry) => entry.name)).not.toContain('FlyingProbeTesting.json')
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
