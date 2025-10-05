import { suite } from 'uvu'
import { generate } from '../src/generator'
import * as assert from 'uvu/assert'

const test = suite('Generator')

test('creates an Outcome with default tagThresholds', async () => {
  const world = generate('DICTIONARY.md')
})

test.run()
