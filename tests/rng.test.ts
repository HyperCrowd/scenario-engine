import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import SimpleSeededRNG from '../src/rng'

const rngTests = suite('SimpleSeededRNG')

// Test that random numbers are in [0,1)
rngTests('random() returns numbers in [0,1)', () => {
  const rng = new SimpleSeededRNG('test-seed')
  for (let i = 0; i < 1000; i++) {
    const r = rng.random()
    assert.ok(r >= 0 && r < 1, `random() out of range: ${r}`)
  }
})

// Test that randomInt returns integers in [min,max)
rngTests('randomInt() returns integers in range', () => {
  const rng = new SimpleSeededRNG('test-seed')
  const min = 5
  const max = 15
  for (let i = 0; i < 1000; i++) {
    const r = rng.randomInt(min, max)
    assert.ok(Number.isInteger(r), `randomInt() not integer: ${r}`)
    assert.ok(r >= min && r < max, `randomInt() out of range: ${r}`)
  }
})

// Test determinism: same seed → same sequence
rngTests('same seed produces same sequence', () => {
  const seed = 'deterministic'
  const rng1 = new SimpleSeededRNG(seed)
  const rng2 = new SimpleSeededRNG(seed)

  const sequence1: number[] = []
  const sequence2: number[] = []

  for (let i = 0; i < 100; i++) {
    sequence1.push(rng1.random())
    sequence2.push(rng2.random())
  }

  assert.equal(sequence1, sequence2)
})

// Test different seeds produce different sequences
rngTests('different seeds produce different sequences', () => {
  const rng1 = new SimpleSeededRNG('seed1')
  const rng2 = new SimpleSeededRNG('seed2')

  let identical = true
  for (let i = 0; i < 100; i++) {
    if (rng1.random() !== rng2.random()) {
      identical = false
      break
    }
  }
  assert.ok(!identical, 'Different seeds produced identical sequences')
})

rngTests.run()
