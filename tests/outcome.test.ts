import Tag from '../src/tag'
import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import Outcome from '../src/outcome'

const test = suite('Outcome')

test('creates an Outcome with default tagThresholds', async () => {
  const outcome = new Outcome(0.5, 'NextTable')
  assert.is(outcome.likelihood, 0.5)
  assert.is(outcome.tableName, 'NextTable')
  assert.equal(outcome.tagThresholds, [])
})

test('creates an Outcome with provided tagThresholds', async () => {
  const thresholds = [
    new Tag('Courage', 10),
    new Tag('Wisdom', 5)
  ]
  const outcome = new Outcome(0.8, 'HeroTable', thresholds)
  assert.is(outcome.likelihood, 0.8)
  assert.is(outcome.tableName, 'HeroTable')
  assert.equal(outcome.tagThresholds, thresholds)
})

test.run()
