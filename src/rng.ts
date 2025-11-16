/**
 * SimpleSeededRNG
 *
 * Lightweight deterministic RNG for browsers.
 * Based on Mulberry32: fast, good-quality random stream from a seed.
 * If no seed is provided, uses crypto.getRandomValues for unseeded randomness.
 */
export default class SimpleSeededRNG {
  private state: number
  readonly seed: string | number | undefined

  constructor(seed?: number | string) {
    if (seed === undefined) {
      // Use cryptographically secure randomness
      const array = new Uint32Array(1)
      crypto.getRandomValues(array)
      this.state = array[0]
    } else if (typeof seed === 'string') {
      let h = 1779033703 ^ seed.length
      for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
        h = (h << 13) | (h >>> 19)
      }
      this.state = h >>> 0
    } else {
      this.state = seed >>> 0
    }
    this.seed = seed
  }

  /** Returns a float between 0 (inclusive) and 1 (exclusive). */
  random(): number {
    this.state += 0x6D2B79F5
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Returns an integer between min (inclusive) and max (exclusive). */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min
  }
}
