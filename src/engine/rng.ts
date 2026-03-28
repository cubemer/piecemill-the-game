export interface RNG {
  /** Returns a float in [0, 1) */
  next(): number
  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number
  /** Returns true with the given probability (0-1) */
  nextBool(probability: number): boolean
  /** Creates an independent child RNG */
  fork(): RNG
}

/**
 * splitmix32 — expands a single number seed into state bits.
 * Used to initialize xoshiro128** from a single seed.
 */
function splitmix32(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x9e3779b9) | 0
    let z = state
    z = ((z ^ (z >>> 16)) * 0x85ebca6b) | 0
    z = ((z ^ (z >>> 13)) * 0xc2b2ae35) | 0
    return (z ^ (z >>> 16)) >>> 0
  }
}

/**
 * xoshiro128** — fast, high-quality 32-bit PRNG.
 * Deterministic: same seed always produces the same sequence.
 */
export function createRNG(seed: number): RNG {
  const sm = splitmix32(seed)
  let s0 = sm()
  let s1 = sm()
  let s2 = sm()
  let s3 = sm()

  function nextU32(): number {
    const x = Math.imul(s1, 5) >>> 0
    const rotated = ((x << 7) | (x >>> 25)) >>> 0
    const result = (Math.imul(rotated, 9)) >>> 0
    const t = (s1 << 9) >>> 0

    s2 ^= s0
    s3 ^= s1
    s1 ^= s2
    s0 ^= s3
    s2 ^= t
    s3 = ((s3 << 11) | (s3 >>> 21)) >>> 0

    return result
  }

  const rng: RNG = {
    next() {
      return nextU32() / 0x100000000
    },

    nextInt(min, max) {
      return min + (nextU32() % (max - min + 1))
    },

    nextBool(probability) {
      return rng.next() < probability
    },

    fork() {
      return createRNG(nextU32())
    },
  }

  return rng
}
