// tests/scenario.extended.test.ts
import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import Scenario from '../src/scenario'
import ScenarioEvent from '../src/scenarioEvent'
import Outcome from '../src/outcome'
import TableManager from '../src/tableManager'
import TableEntry from '../src/tableEntry'
import Table from '../src/table'
import Tag from '../src/tag'
import SimpleSeededRNG from '../src/rng'

const scenarioTests = suite('Scenarios')

scenarioTests.before.each(() => {
  TableManager.clearAll()
})

class MockRNG extends SimpleSeededRNG {
  random: () => 0.5
  randomInt: () => 0
}

/**
 * 
 */
const getRng = (random: number | (() => number), randomInt: number | ((max: number) => number)) => {
  class MockRNG extends SimpleSeededRNG {
    random(): number {
      return typeof random === 'function'
        ? random()
        : random
    }

    randomInt(min: number, max: number): number {
      return typeof randomInt === 'function'
        ? randomInt(max)
        : randomInt
    }
  }

  return new MockRNG()
}


// --- Test: Multiple tags accumulate correctly ---
scenarioTests.only('accumulates multiple different tags across entries', async () => {
  const scenario = new Scenario('MultiTagScenario', getRng(0.5, 0))

  new Table('Table1', [new TableEntry(1, 1, 'Start', [
    new Tag('strength', 2),
    new Tag('wisdom', 1)
  ])])

  new Table('Table2', [new TableEntry(1, 1, 'Middle', [
    new Tag('strength', 3),
    new Tag('agility', 2)
  ])])

  new Table('Table3', [new TableEntry(1, 1, 'End', [])])

  scenario.register(new ScenarioEvent('Table1', 'Start', [new Outcome(1, 'Table2')]))
  scenario.register(new ScenarioEvent('Table2', 'Middle', [new Outcome(1, 'Table3')]))

  const path = await scenario.create()

  assert.equal(path.length, 2)
  assert.is(path[0].accumulatedTags.get('strength'), 2)
  assert.is(path[0].accumulatedTags.get('wisdom'), 1)
  assert.is(path[1].accumulatedTags.get('strength'), 5) // 2 + 3
  assert.is(path[1].accumulatedTags.get('wisdom'), 1)
  assert.is(path[1].accumulatedTags.get('agility'), 2)
})

// --- Test: Likelihood-based branching with multiple outcomes ---
scenarioTests('selects outcomes based on likelihood weights', async () => {
  const entry1 = new TableEntry(1, 1, 'Choice', [])
  new Table('Start', [entry1])
  new Table('PathA', [new TableEntry(1, 1, 'A', [])])
  new Table('PathB', [new TableEntry(1, 1, 'B', [])])
  new Table('PathC', [new TableEntry(1, 1, 'C', [])])

  const outcomes = [
    new Outcome(1, 'PathA'),  // 10% chance
    new Outcome(3, 'PathB'),  // 30% chance
    new Outcome(6, 'PathC')   // 60% chance
  ]

  const counts = { PathA: 0, PathB: 0, PathC: 0 }

  for (let trial = 0; trial < 1000; trial++) {
    TableManager.clearAll()
    new Table('Start', [entry1])
    new Table('PathA', [new TableEntry(1, 1, 'A', [])])
    new Table('PathB', [new TableEntry(1, 1, 'B', [])])
    new Table('PathC', [new TableEntry(1, 1, 'C', [])])

    const scenario = new Scenario('LikelihoodTest', getRng(() => Math.random(), 0))

    scenario.register(new ScenarioEvent('Start', 'Choice', outcomes))
    const path = await scenario.create()

    if (path.length > 1) {
      counts[path[1].tableName as keyof typeof counts]++
    }
  }

  // Check distributions are roughly correct (with tolerance)
  assert.ok(counts.PathA > 50 && counts.PathA < 150, `PathA: ${counts.PathA}`)
  assert.ok(counts.PathB > 200 && counts.PathB < 400, `PathB: ${counts.PathB}`)
  assert.ok(counts.PathC > 500 && counts.PathC < 700, `PathC: ${counts.PathC}`)
})

// --- Test: Tag threshold blocks lower-priority outcomes ---
scenarioTests('tag threshold takes priority over likelihood', async () => {
  const entry1 = new TableEntry(1, 1, 'Start', [new Tag('power', 10)])
  new Table('Table1', [entry1])
  new Table('WeakPath', [new TableEntry(1, 1, 'Weak', [])])
  new Table('StrongPath', [new TableEntry(1, 1, 'Strong', [])])

  const scenario = new Scenario('ThresholdPriority', getRng(0.1, 0))

  // High likelihood outcome without threshold
  // Low likelihood outcome WITH threshold that will be met
  const outcomes = [
    new Outcome(9, 'WeakPath'),  // High likelihood but no threshold
    new Outcome(1, 'StrongPath', [{ name: 'power', minValue: 10 }])  // Threshold met
  ]

  scenario.register(new ScenarioEvent('Table1', 'Start', outcomes))

  const path = await scenario.create()

  // Should take StrongPath because threshold is met, despite lower likelihood
  assert.equal(path.length, 2)
  assert.is(path[1].tableName, 'StrongPath')
})

// --- Test: Multiple tag thresholds must ALL be met ---
scenarioTests('outcome requires all tag thresholds to be met', async () => {
  const entry1 = new TableEntry(1, 1, 'Quest', [
    new Tag('strength', 5),
    new Tag('wisdom', 3)
  ])
  new Table('Table1', [entry1])
  new Table('Success', [new TableEntry(1, 1, 'Victory', [])])
  new Table('Failure', [new TableEntry(1, 1, 'Defeat', [])])

  // Test when both thresholds ARE met
  const scenario1 = new Scenario('BothMet', getRng(0.5, 0))

  const outcomes1 = [
    new Outcome(1, 'Success', [
      { name: 'strength', minValue: 5 },
      { name: 'wisdom', minValue: 3 }
    ]),
    new Outcome(1, 'Failure')
  ]

  scenario1.register(new ScenarioEvent('Table1', 'Quest', outcomes1))
  const path1 = await scenario1.create()

  assert.is(path1[path1.length - 1].tableName, 'Success')

  // Test when one threshold is NOT met
  TableManager.clearAll()
  const entry2 = new TableEntry(1, 1, 'Quest', [
    new Tag('strength', 5),
    new Tag('wisdom', 2)  // Below threshold
  ])
  new Table('Table1', [entry2])
  new Table('Success', [new TableEntry(1, 1, 'Victory', [])])
  new Table('Failure', [new TableEntry(1, 1, 'Defeat', [])])

  const scenario2 = new Scenario('OneMissing', getRng(0.5, 0))

  scenario2.register(new ScenarioEvent('Table1', 'Quest', outcomes1))
  const path2 = await scenario2.create()

  assert.is(path2[path2.length - 1].tableName, 'Failure')
})

// --- Test: Long chain scenario ---
scenarioTests('handles long chain of events', async () => {
  const tables: Table[] = []
  for (let i = 1; i <= 10; i++) {
    const entry = new TableEntry(1, 1, `Step${i}`, [new Tag('progress', i)])
    tables.push(new Table(`Table${i}`, [entry]))
  }

  const scenario = new Scenario('LongChain', getRng(0.5, 0))

  for (let i = 1; i < 10; i++) {
    scenario.register(
      new ScenarioEvent(`Table${i}`, `Step${i}`, [new Outcome(1, `Table${i + 1}`)])
    )
  }

  const path = await scenario.create()

  assert.equal(path.length, 10)
  assert.is(path[9].accumulatedTags.get('progress'), 55) // Sum 1..10
})

// --- Test: Scenario terminates when no matching event ---
scenarioTests('terminates gracefully when no next event matches', async () => {
  const entry1 = new TableEntry(1, 1, 'Start', [])
  const entry2 = new TableEntry(1, 1, 'End', [])
  new Table('Table1', [entry1])
  new Table('Table2', [entry2])

  const scenario = new Scenario('NoMatchingEvent', getRng(0.5, 0))

  // Only register event for Table1, not Table2
  scenario.register(new ScenarioEvent('Table1', 'Start', [new Outcome(1, 'Table2')]))

  const path = await scenario.create()

  assert.equal(path.length, 2)
  assert.is(path[0].tableName, 'Table1')
  assert.is(path[1].tableName, 'Table2')
})

// --- Test: Entry with no tags maintains empty accumulated tags ---
scenarioTests('entries without tags do not modify accumulated tags', async () => {
  const entry1 = new TableEntry(1, 1, 'Tagged', [new Tag('magic', 5)])
  const entry2 = new TableEntry(1, 1, 'Untagged', [])
  new Table('Table1', [entry1])
  new Table('Table2', [entry2])

  const scenario = new Scenario('NoTagModification', getRng(0.5, 0))

  scenario.register(new ScenarioEvent('Table1', 'Tagged', [new Outcome(1, 'Table2')]))

  const path = await scenario.create()

  assert.is(path[0].accumulatedTags.get('magic'), 5)
  assert.is(path[1].accumulatedTags.get('magic'), 5) // Still 5, not modified
})

// --- Test: Outcome with zero likelihood is never selected ---
scenarioTests('zero likelihood outcome is never selected', async () => {
  const entry1 = new TableEntry(1, 1, 'Choice', [])
  new Table('Start', [entry1])
  new Table('Never', [new TableEntry(1, 1, 'ShouldNotReach', [])])
  new Table('Always', [new TableEntry(1, 1, 'ShouldReach', [])])

  let neverReached = false

  for (let i = 0; i < 100; i++) {
    TableManager.clearAll()
    new Table('Start', [entry1])
    new Table('Never', [new TableEntry(1, 1, 'ShouldNotReach', [])])
    new Table('Always', [new TableEntry(1, 1, 'ShouldReach', [])])

    const scenario = new Scenario('ZeroLikelihood', getRng(() => Math.random(), 0))

    scenario.register(
      new ScenarioEvent('Start', 'Choice', [
        new Outcome(0, 'Never'),
        new Outcome(1, 'Always')
      ])
    )

    const path = await scenario.create()

    if (path.length > 1 && path[1].tableName === 'Never') {
      neverReached = true
      break
    }
  }

  assert.not(neverReached, 'Zero likelihood outcome was selected')
})

// --- Test: Complex branching with multiple threshold checks ---
scenarioTests('complex scenario with multiple branching points', async () => {
  new Table('Start', [new TableEntry(1, 1, 'Begin', [new Tag('score', 0)])])
  new Table('Choice1', [new TableEntry(1, 1, 'FirstChoice', [new Tag('score', 5)])])
  new Table('Choice2', [new TableEntry(1, 1, 'SecondChoice', [new Tag('score', 3)])])
  new Table('GoodEnding', [new TableEntry(1, 1, 'Victory', [])])
  new Table('BadEnding', [new TableEntry(1, 1, 'Defeat', [])])

  const scenario = new Scenario('ComplexBranching', getRng(0.5, 0))

  scenario.register(new ScenarioEvent('Start', 'Begin', [new Outcome(1, 'Choice1')]))
  scenario.register(new ScenarioEvent('Choice1', 'FirstChoice', [new Outcome(1, 'Choice2')]))
  scenario.register(
    new ScenarioEvent('Choice2', 'SecondChoice', [
      new Outcome(1, 'GoodEnding', [{ name: 'score', minValue: 8 }]),
      new Outcome(1, 'BadEnding')
    ])
  )

  const path = await scenario.create()

  // score accumulates to 8 (0 + 5 + 3), so should reach good ending
  assert.equal(path.length, 4)
  assert.is(path[3].tableName, 'GoodEnding')
})

// --- Test: Different RNG produces different paths ---
scenarioTests('different RNG seeds produce different paths', async () => {
  const entry1 = new TableEntry(1, 50, 'Low', [])
  const entry2 = new TableEntry(51, 100, 'High', [])
  new Table('Start', [entry1, entry2])

  const scenario1 = new Scenario('RNG1', getRng(0.3, (max: number) => Math.floor(0.3 * max)))
  scenario1.register(new ScenarioEvent('Start', 'Low', []))

  const scenario2 = new Scenario('RNG2', getRng(0.8, (max: number) => Math.floor(0.8 * max)))
  scenario2.register(new ScenarioEvent('Start', 'High', []))

  const path1 = await scenario1.create()
  const path2 = await scenario2.create()

  assert.is(path1[0].entry.name, 'Low')
  assert.is(path2[0].entry.name, 'High')
})

scenarioTests.run()