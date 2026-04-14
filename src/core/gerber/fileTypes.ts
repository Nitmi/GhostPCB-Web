import type { GerberFileType, KnownGerberFileType } from './types.ts'

const FIXED_EXTENSION_TYPES: Record<string, KnownGerberFileType> = {
  GBL: 'bottom-copper',
  GBO: 'bottom-silkscreen',
  GBS: 'bottom-mask',
  GBP: 'bottom-paste',
  DRL: 'drill',
  GKO: 'outline',
  GTL: 'top-copper',
  GTO: 'top-silkscreen',
  GTP: 'top-paste',
  GTS: 'top-mask',
}

const LAYER_NAMES: Record<Exclude<KnownGerberFileType, 'inner-layer'>, string> = {
  'bottom-copper': 'Bottom Layer',
  'bottom-mask': 'Bottom Solder Mask',
  'bottom-paste': 'Bottom Paste',
  'bottom-silkscreen': 'Bottom Silk Layer',
  drill: 'Drill Layer',
  outline: 'Board Outline',
  'top-copper': 'Top Layer',
  'top-mask': 'Top Solder Mask',
  'top-paste': 'Top Paste',
  'top-silkscreen': 'Top Silk Layer',
}

function getFileExtension(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() ?? fileName
  const ext = baseName.includes('.') ? baseName.split('.').pop() : baseName
  return (ext ?? '').toUpperCase()
}

export function detectGerberFileType(fileName: string): GerberFileType {
  const extension = getFileExtension(fileName)
  const fixedType = FIXED_EXTENSION_TYPES[extension]

  if (fixedType) {
    return fixedType
  }

  if (/^G.+$/i.test(extension) && extension.length >= 2) {
    return 'inner-layer'
  }

  return 'unknown'
}

export function isKnownGerberType(type: GerberFileType): type is KnownGerberFileType {
  return type !== 'unknown'
}

export function isDrillType(type: GerberFileType): type is 'drill' {
  return type === 'drill'
}

export function isSilkscreenType(type: GerberFileType): boolean {
  return type === 'top-silkscreen' || type === 'bottom-silkscreen'
}

export function getLayerDisplayName(
  fileName: string,
  type: Exclude<KnownGerberFileType, 'drill'>,
): string {
  if (type === 'inner-layer') {
    const extension = getFileExtension(fileName)
    const layerNumber = extension.replace(/^G/i, '')
    return `Inner Layer ${layerNumber}`
  }

  return LAYER_NAMES[type]
}
