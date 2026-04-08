export interface SeededRandom {
  next: () => number
  integer: (min: number, max: number) => number
  range: (min: number, max: number) => number
  pick: <T>(values: T[]) => T
}

export function hashSeed(input: string): number {
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function mixSeed(base: number, salt: number): number {
  return hashSeed(`${base}:${salt}`)
}

export function createRng(seed: number): SeededRandom {
  let state = seed >>> 0 || 0x6d2b79f5

  const next = () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    integer(min, max) {
      const safeMin = Math.ceil(Math.min(min, max))
      const safeMax = Math.floor(Math.max(min, max))
      return Math.floor(next() * (safeMax - safeMin + 1)) + safeMin
    },
    range(min, max) {
      const safeMin = Math.min(min, max)
      const safeMax = Math.max(min, max)
      return safeMin + (safeMax - safeMin) * next()
    },
    pick(values) {
      if (values.length === 0) {
        throw new Error('无法从空数组中选择随机值')
      }

      return values[Math.floor(next() * values.length)]
    },
  }
}
