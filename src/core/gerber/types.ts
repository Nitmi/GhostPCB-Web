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

export interface GerberTextEntry {
  name: string
  type: KnownGerberFileType
  content: string
}
