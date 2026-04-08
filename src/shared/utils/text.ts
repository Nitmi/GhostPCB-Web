export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n')
}

export function decodeTextFile(data: Uint8Array, fileName: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    throw new Error(`Gerber 文件读取失败: ${fileName}`)
  }
}

export function encodeTextFile(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}
