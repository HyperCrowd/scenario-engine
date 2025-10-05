import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import TableEntry from '../src/tableEntry'
import Tag from '../src/tag'

const test = suite('Table')

test('TableEntry constructor sets values correctly', () => {
  const tags = [new Tag('magic', 3)]
  const entry = new TableEntry(10, 20, 'Treasure Chest', tags)

  assert.is(entry.start, 10)
  assert.is(entry.end, 20)
  assert.is(entry.name, 'Treasure Chest')
  assert.equal(entry.tags, tags)
})

test('TableEntry matches() returns true when value is in range', () => {
  const entry = new TableEntry(5, 15, 'Goblin')

  assert.ok(entry.matches(5))
  assert.ok(entry.matches(10))
  assert.ok(entry.matches(15))
})

test('TableEntry matches() returns false when value is out of range', () => {
  const entry = new TableEntry(5, 15, 'Goblin')

  assert.not(entry.matches(4))
  assert.not(entry.matches(16))
})

test('TableEntry handles missing tags correctly', () => {
  const entry = new TableEntry(1, 2, 'No Tags')

  assert.instance(entry.tags, Array)
  assert.is(entry.tags.length, 0)
})

test.run()
