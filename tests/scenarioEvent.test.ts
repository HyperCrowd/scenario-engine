import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import ScenarioEvent, { Outcome } from '../src/scenarioEvent'

const scenarioTests = suite('ScenarioEvent')

// --- Test constructor ---
scenarioTests('constructor assigns properties correctly', () => {
  const outcomes: Outcome[] = [
    { likelihood: 0.5, nextTable: 'TableA' },
    { likelihood: 0.5, nextTable: 'TableB' }
  ]

  const event = new ScenarioEvent('MyTable', 'MyEntry', outcomes)

  assert.is(event.tableName, 'MyTable')
  assert.is(event.entryName, 'MyEntry')
  assert.equal(event.outcomes, outcomes)
})

// --- Test selectOutcome returns one of the outcomes ---
scenarioTests('selectOutcome returns an outcome from the list', async () => {
  const outcomes: Outcome[] = [
    { likelihood: 0.5, nextTable: 'TableA' },
    { likelihood: 0.5, nextTable: 'TableB' }
  ]
  const event = new ScenarioEvent('Table', 'Entry', outcomes)

  const result = await event.selectOutcome()
  assert.ok(result !== null)
  assert.ok(outcomes.includes(result as Outcome))
})

// --- Test selectOutcome respects likelihoods (statistical test) ---
scenarioTests('selectOutcome respects likelihoods', async () => {
  const outcomes: Outcome[] = [
    { likelihood: 1, nextTable: 'A' },
    { likelihood: 3, nextTable: 'B' }
  ]
  const event = new ScenarioEvent('Table', 'Entry', outcomes)

  const counts: Record<string, number> = { A: 0, B: 0 }
  const trials = 1000

  for (let i = 0; i < trials; i++) {
    const o = await event.selectOutcome()
    if (o) counts[o.nextTable!]++
  }

  // B should occur roughly 3x as often as A
  const ratio = counts.B / counts.A
  assert.ok(ratio > 2.5 && ratio < 3.5, `ratio ${ratio} not approx 3`)
})

scenarioTests.run()
