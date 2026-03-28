import { describe, it, expect } from 'vitest'
import { createRNG } from '../rng'

describe('createRNG', () => {
  it('produces deterministic sequences from the same seed', () => {
    const a = createRNG(42)
    const b = createRNG(42)

    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())

    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences from different seeds', () => {
    const a = createRNG(42)
    const b = createRNG(99)

    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())

    expect(seqA).not.toEqual(seqB)
  })

  it('next() returns values in [0, 1)', () => {
    const rng = createRNG(123)
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('nextInt() returns values in [min, max] inclusive', () => {
    const rng = createRNG(456)
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(1, 6)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
      seen.add(v)
    }
    // should eventually hit all values 1-6
    expect(seen.size).toBe(6)
  })

  it('nextBool() respects probability', () => {
    const rng = createRNG(789)
    let trueCount = 0
    const trials = 10000
    for (let i = 0; i < trials; i++) {
      if (rng.nextBool(0.3)) trueCount++
    }
    // should be roughly 30% — allow wide margin
    expect(trueCount / trials).toBeGreaterThan(0.25)
    expect(trueCount / trials).toBeLessThan(0.35)
  })

  it('fork() creates an independent RNG', () => {
    const parent = createRNG(42)
    parent.next() // advance parent
    const child = parent.fork()

    // advancing child should not affect parent
    const childVal = child.next()
    const parentVal = parent.next()
    expect(childVal).not.toBe(parentVal)

    // forked RNG is deterministic too
    const parent2 = createRNG(42)
    parent2.next()
    const child2 = parent2.fork()
    expect(child2.next()).toBe(childVal)
  })
})
