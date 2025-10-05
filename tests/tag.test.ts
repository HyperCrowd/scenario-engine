import { test } from 'uvu'
import Tag from '../src/tag'
import * as assert from 'uvu/assert'

test('Tag constructor sets name and value correctly', () => {
  const tag = new Tag('rare', 5)

  assert.is(tag.name, 'rare')
  assert.is(tag.value, 5)
})

test.run()
