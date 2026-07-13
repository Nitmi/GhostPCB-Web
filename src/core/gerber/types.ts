export type GerberFileType =
  | 'top-copper'
  | 'bottom-copper'
  | 'top-silkscreen'
  | 'bottom-silkscreen'
  | 'top-mask'
  | 'bottom-mask'
  | 'top-paste'
  | 'bottom-paste'
  | 'outline'
  | 'drill'
  | 'inner-layer'
  | 'unknown'

export type KnownGerberFileType = Exclude<GerberFileType, 'unknown'>

export type DrillFileRole = 'plated' | 'non-plated' | 'via'

export interface GerberTextEntry {
  name: string
  type: KnownGerberFileType
  content: string
}

export interface PreparedGerberEntry extends GerberTextEntry {
  outputName: string
  drillRole?: DrillFileRole
}

export interface PackageExtraEntry {
  name: string
  data: Uint8Array
}

export interface DrillMergeBucket {
  outputName: string
  drillRole: DrillFileRole
  entries: Array<{
    name: string
    content: string
  }>
}
