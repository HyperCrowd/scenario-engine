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

scenarioTests('accumulates multiple different tags across entries', () => {
  const rng = getRng(0.5, 52)

  new Table('QuestStart', [
    new TableEntry(1, 60, 'Village Tavern', '', [new Tag('safe', 1)]),
    new TableEntry(61, 100, 'Dark Forest', '', [new Tag('danger', 2)])
  ])

  new Table('TavernEvents', [
    new TableEntry(1, 50, 'Meet Friendly NPC', '', [new Tag('safe', 1)]),
    new TableEntry(51, 100, 'Overhear Quest Hook', '', [new Tag('intrigue', 1)])
  ])

  new Table('ForestEvents', [
    new TableEntry(1, 70, 'Goblin Ambush', '', [new Tag('danger', 2)]),
    new TableEntry(71, 100, 'Ancient Ruins', '', [new Tag('treasure', 1)])
  ])

  // Create the scenario with seeded RNG
  const scenario = new Scenario('Village Quest', rng)

  // Chain the tables: "When you roll 'Village Tavern', go to TavernEvents"
  scenario.add(new ScenarioEvent('QuestStart', 'Village Tavern', [
    new Outcome(1, 'TavernEvents')
  ]))

  scenario.add(new ScenarioEvent('QuestStart', 'Dark Forest', [
    new Outcome(1, 'ForestEvents')
  ]))

  // Run the scenario
  const { path } = scenario.run()

  assert.is(path.length, 2)

  assert.is(path[0].roll, 53)
  assert.is(path[0].tableName, 'QuestStart')
  assert.is(path[0].entry, 'Village Tavern')
  assert.is(path[0].tags.get('safe'), 1)

  assert.is(path[1].roll, 53)
  assert.is(path[1].tableName, 'TavernEvents')
  assert.is(path[1].entry, 'Overhear Quest Hook')
  assert.is(path[1].tags.get('safe'), 1)
  assert.is(path[1].tags.get('intrigue'), 1)
})


// --- Test: Multiple tags accumulate correctly ---
scenarioTests('accumulates multiple different tags across entries', () => {
  const scenario = new Scenario('MultiTagScenario', getRng(0.5, 0))

  new Table('Table1', [new TableEntry(1, 1, 'Start', '', [
    new Tag('strength', 2),
    new Tag('wisdom', 1)
  ])])

  new Table('Table2', [new TableEntry(1, 1, 'Middle', '', [
    new Tag('strength', 3),
    new Tag('agility', 2)
  ])])

  new Table('Table3', [new TableEntry(1, 1, 'End', '', [])])

  scenario.add(new ScenarioEvent('Table1', 'Start', [new Outcome(1, 'Table2')]))
  scenario.add(new ScenarioEvent('Table2', 'Middle', [new Outcome(1, 'Table3')]))

  const { path } = scenario.run()

  assert.is(path.length, 3)

  assert.is(path[0].roll, 1)
  assert.is(path[0].tableName, 'Table1')
  assert.is(path[0].entry, 'Start')
  assert.is(path[0].tags.get('strength'), 2)
  assert.is(path[0].tags.get('wisdom'), 1)

  assert.is(path[1].roll, 1)
  assert.is(path[1].tableName, 'Table2')
  assert.is(path[1].entry, 'Middle')
  assert.is(path[1].tags.get('strength'), 5)
  assert.is(path[1].tags.get('wisdom'), 1)
  assert.is(path[1].tags.get('agility'), 2)

  assert.is(path[2].roll, 1)
  assert.is(path[2].tableName, 'Table3')
  assert.is(path[2].entry, 'End')
  assert.is(path[2].tags.get('strength'), 5)
  assert.is(path[2].tags.get('wisdom'), 1)
  assert.is(path[2].tags.get('agility'), 2)
})

// --- Test: Likelihood-based branching with multiple outcomes ---
scenarioTests('selects outcomes based on likelihood weights', () => {
  const entry1 = new TableEntry(1, 1, 'Choice', '', [])
  new Table('Start', [entry1])
  new Table('PathA', [new TableEntry(1, 1, 'A', '', [])])
  new Table('PathB', [new TableEntry(1, 1, 'B', '', [])])
  new Table('PathC', [new TableEntry(1, 1, 'C', '', [])])

  const outcomes = [
    new Outcome(1, 'PathA'),  // 10% chance
    new Outcome(3, 'PathB'),  // 30% chance
    new Outcome(6, 'PathC')   // 60% chance
  ]

  const counts = { PathA: 0, PathB: 0, PathC: 0 }

  for (let trial = 0; trial < 1000; trial++) {
    TableManager.clearAll()
    new Table('Start', [entry1])
    new Table('PathA', [new TableEntry(1, 1, 'A', '', [])])
    new Table('PathB', [new TableEntry(1, 1, 'B', '', [])])
    new Table('PathC', [new TableEntry(1, 1, 'C', '', [])])

    const scenario = new Scenario('LikelihoodTest', getRng(() => Math.random(), 0))

    scenario.add(new ScenarioEvent('Start', 'Choice', outcomes))
    const { path } = scenario.run()

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
scenarioTests('tag threshold takes priority over likelihood', () => {
  new Table('Table1', [
    new TableEntry(1, 1, 'Start', '', [
      new Tag('power', 10)
    ])
  ])
  new Table('WeakPath', [new TableEntry(1, 1, 'Weak', '', [])])
  new Table('StrongPath', [new TableEntry(1, 1, 'Strong', '', [])])

  const scenario = new Scenario('ThresholdPriority', getRng(0.1, 0))

  scenario.add(new ScenarioEvent('Table1', 'Start', [
    new Outcome(0.9, 'WeakPath'),  // High likelihood but no threshold
    new Outcome(0.1, 'StrongPath', [new Tag('power', 10)])  // Threshold met
  ]))

  const { path } = scenario.run()

  // Should take StrongPath because threshold is met, despite lower likelihood
  assert.equal(path.length, 2)
  assert.is(path[1].tableName, 'StrongPath')
})

// --- Test: Long chain scenario ---
scenarioTests('handles long chain of events', () => {
  const tables: Table[] = []
  for (let i = 1; i <= 10; i++) {
    const entry = new TableEntry(1, 1, `Step${i}`, '', [new Tag('progress', i)])
    tables.push(new Table(`Table${i}`, [entry]))
  }

  const scenario = new Scenario('LongChain', getRng(0.5, 0))

  for (let i = 1; i < 10; i++) {
    scenario.add(
      new ScenarioEvent(`Table${i}`, `Step${i}`, [new Outcome(1, `Table${i + 1}`)])
    )
  }

  const { path } = scenario.run()

  assert.equal(path.length, 10)
  assert.is(path[9].tags.get('progress'), 55) // Sum 1..10
})

// --- Test: Scenario terminates when no matching event ---
scenarioTests('terminates gracefully when no next event matches', () => {
  const entry1 = new TableEntry(1, 1, 'Start', '', [])
  const entry2 = new TableEntry(1, 1, 'End', '', [])
  new Table('Table1', [entry1])
  new Table('Table2', [entry2])

  const scenario = new Scenario('NoMatchingEvent', getRng(0.5, 0))

  // Only register event for Table1, not Table2
  scenario.add(new ScenarioEvent('Table1', 'Start', [new Outcome(1, 'Table2')]))

  const { path } = scenario.run()

  assert.equal(path.length, 2)
  assert.is(path[0].tableName, 'Table1')
  assert.is(path[1].tableName, 'Table2')
})

// --- Test: Entry with no tags maintains empty accumulated tags ---
scenarioTests('entries without tags do not modify accumulated tags', () => {
  const entry1 = new TableEntry(1, 1, 'Tagged', '', [new Tag('magic', 5)])
  const entry2 = new TableEntry(1, 1, 'Untagged', '', [])
  new Table('Table1', [entry1])
  new Table('Table2', [entry2])

  const scenario = new Scenario('NoTagModification', getRng(0.5, 0))

  scenario.add(new ScenarioEvent('Table1', 'Tagged', [new Outcome(1, 'Table2')]))

  const { path } = scenario.run()

  assert.is(path[0].tags.get('magic'), 5)
  assert.is(path[1].tags.get('magic'), 5) // Still 5, not modified
})

// --- Test: Outcome with zero likelihood is never selected ---
scenarioTests('zero likelihood outcome is never selected', () => {
  const entry1 = new TableEntry(1, 1, 'Choice', '', [])
  new Table('Start', [entry1])
  new Table('Never', [new TableEntry(1, 1, 'ShouldNotReach', '', [])])
  new Table('Always', [new TableEntry(1, 1, 'ShouldReach', '', [])])

  let neverReached = false

  for (let i = 0; i < 100; i++) {
    TableManager.clearAll()
    new Table('Start', [entry1])
    new Table('Never', [new TableEntry(1, 1, 'ShouldNotReach', '', [])])
    new Table('Always', [new TableEntry(1, 1, 'ShouldReach', '', [])])

    const scenario = new Scenario('ZeroLikelihood', getRng(() => Math.random(), 0))

    scenario.add(
      new ScenarioEvent('Start', 'Choice', [
        new Outcome(0, 'Never'),
        new Outcome(1, 'Always')
      ])
    )

    const { path } = scenario.run()

    if (path.length > 1 && path[1].tableName === 'Never') {
      neverReached = true
      break
    }
  }

  assert.not(neverReached, 'Zero likelihood outcome was selected')
})

// --- Test: Complex branching with multiple threshold checks ---
scenarioTests('complex scenario with multiple branching points', () => {
  new Table('Start', [new TableEntry(1, 1, 'Begin', '', [new Tag('score', 0)])])
  new Table('Choice1', [new TableEntry(1, 1, 'FirstChoice', '', [new Tag('score', 5)])])
  new Table('Choice2', [new TableEntry(1, 1, 'SecondChoice', '', [new Tag('score', 3)])])
  new Table('GoodEnding', [new TableEntry(1, 1, 'Victory', '', [])])
  new Table('BadEnding', [new TableEntry(1, 1, 'Defeat', '', [])])

  const scenario = new Scenario('ComplexBranching', getRng(0.5, 0))

  scenario.add(new ScenarioEvent('Start', 'Begin', [new Outcome(1, 'Choice1')]))
  scenario.add(new ScenarioEvent('Choice1', 'FirstChoice', [new Outcome(1, 'Choice2')]))
  scenario.add(
    new ScenarioEvent('Choice2', 'SecondChoice', [
      new Outcome(1, 'GoodEnding', [new Tag('score', 8)]),
      new Outcome(1, 'BadEnding')
    ])
  )

  const { path } = scenario.run()

  // score accumulates to 8 (0 + 5 + 3), so should reach good ending
  assert.equal(path.length, 4)
  assert.is(path[3].tableName, 'GoodEnding')
})

// --- Test: Different RNG produces different paths ---
scenarioTests('different RNG seeds produce different paths', () => {
  new Table('Start', [
    new TableEntry(1, 50, 'Low', '', []),
    new TableEntry(51, 100, 'High', '', [])]
  )

  const scenario1 = new Scenario('RNG1', getRng(0.3, (max: number) => Math.floor(0.3 * max)))
  scenario1.add(new ScenarioEvent('Start', 'Low', []))

  const scenario2 = new Scenario('RNG2', getRng(0.8, (max: number) => Math.floor(0.8 * max)))
  scenario2.add(new ScenarioEvent('Start', 'High', []))

  const { path: path1 } = scenario1.run()
  const { path: path2 } = scenario2.run()

  assert.is(path1[0].entry, 'Low')
  assert.is(path2[0].entry, 'High')
})

// --- Test: Multiple tag thresholds must ALL be met ---
scenarioTests('outcome requires all tag thresholds to be met', () => {
  new Table('Table1', [
    new TableEntry(1, 1, 'Quest', '', [
      new Tag('strength', 5),
      new Tag('wisdom', 3)
    ])  
  ])
  new Table('Success', [new TableEntry(1, 1, 'Victory', '', [])])
  new Table('Failure', [new TableEntry(1, 1, 'Defeat', '', [])])

  // Test when both thresholds ARE met
  const scenario1 = new Scenario('BothMet', getRng(0.5, 0))

  const outcomes1 = [
    new Outcome(1, 'Success', [
      new Tag('strength', 5),
      new Tag('wisdom', 3)
    ]),
    new Outcome(1, 'Failure')
  ]

  scenario1.add(new ScenarioEvent('Table1', 'Quest', outcomes1))
  
  const { path: path1 } = scenario1.run()
  assert.is(path1[path1.length - 1].tableName, 'Success')

  // Test when one threshold is NOT met
  TableManager.clearAll()

  new Table('Table1', [
    new TableEntry(1, 1, 'Quest', '', [
      new Tag('strength', 5),
      new Tag('wisdom', 0)  // Below threshold
    ])
  ])
  new Table('Success', [new TableEntry(1, 1, 'Victory', '', [])])
  new Table('Failure', [new TableEntry(1, 1, 'Defeat', '', [])])

  const scenario2 = new Scenario('OneMissing', getRng(0.5, 0))

  scenario2.add(new ScenarioEvent('Table1', 'Quest', outcomes1))
  const { path: path2 } = scenario2.run()

  assert.is(path2[path2.length - 1].tableName, 'Failure')
})

scenarioTests.run()