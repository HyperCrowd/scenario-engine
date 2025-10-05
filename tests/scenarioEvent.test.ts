import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import ScenarioEvent from '../src/scenarioEvent'
import Outcome
 from '../src/outcome'
const scenarioTests = suite('ScenarioEvent')

// --- Test constructor ---
scenarioTests('constructor assigns properties correctly', () => {
  const outcomes: Outcome[] = [
    new Outcome(0.5, 'TableA'),
    new Outcome(0.5, 'TableB')
  ]

  const event = new ScenarioEvent('MyTable', 'MyEntry', outcomes)

  assert.is(event.tableName, 'MyTable')
  assert.is(event.entryName, 'MyEntry')
  assert.equal(event.outcomes, outcomes)
})

scenarioTests.run()
