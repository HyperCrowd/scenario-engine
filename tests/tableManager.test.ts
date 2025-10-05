import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import TableManager from '../src/tableManager'
import Table from '../src/table'

// --- Test Suite ---
const tableManagerTests = suite('TableManager')

// --- Before each test: clear singleton state ---
tableManagerTests.before.each(() => {
  TableManager.clearAll()
})

// --- Test registering a table ---
tableManagerTests('registerTable stores table correctly', () => {
  const table = new Table('TestTable')

  const retrieved = TableManager.getTable('TestTable')
  assert.is(retrieved, table)
})

// --- Test getTable returns null if missing ---
tableManagerTests('getTable returns null if not found', () => {
  const result = TableManager.getTable('NonExistent')
  assert.is(result, null)
})

// --- Test getAllTables returns all registered tables ---
tableManagerTests('getAllTables returns all tables', () => {
  const tableA = new Table('A')
  const tableB = new Table('B')

  const all = TableManager.getAllTables()
  assert.ok(all.includes(tableA))
  assert.ok(all.includes(tableB))
})

tableManagerTests.run()
