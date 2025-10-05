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

const scenarioTests = suite('README Examples')

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

scenarioTests('first test', () => {
  const rng = getRng(0.5, 52)

  new Table('QuestStart', [
    new TableEntry(1, 60, 'Village Tavern', [
      new Tag('safe', 1)
    ]),
    new TableEntry(61, 100, 'Dark Forest', [
      new Tag('danger', 2)
    ])
  ])

  new Table('TavernEvents', [
    new TableEntry(1, 50, 'Meet Friendly NPC', [
      new Tag('safe', 1)
    ]),
    new TableEntry(51, 100, 'Overhear Quest Hook', [
      new Tag('intrigue', 1)
    ])
  ])

  new Table('ForestEvents', [
    new TableEntry(1, 70, 'Goblin Ambush', [
      new Tag('danger', 2)
    ]),
    new TableEntry(71, 100, 'Ancient Ruins', [
      new Tag('treasure', 1)
    ])
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

scenarioTests('second test', () => {
  new Table('Encounters', [
    new TableEntry(1, 40, 'Goblin Band', [
      new Tag('combat', 1)
    ]),
    new TableEntry(41, 60, 'Traveling Merchant', [
      new Tag('gold', 5)
    ]),
    new TableEntry(61, 70, 'Wolf Pack', [
      new Tag('combat', 2)
    ]),
    new TableEntry(71, 100, 'Ancient Dragon', [new 
      Tag('combat', 5),
      new Tag('legendary', 1)
    ])
  ])

  new Table('CombatResolution', [
    new TableEntry(1, 80, 'Success'),
    new TableEntry(1, 80, 'Failure')
  ])

  new Table('TradeGoods', [
    new TableEntry(1, 80, 'Swap Goods'),
    new TableEntry(1, 80, 'Place Buy Order')
  ])

  new Table('MerchantQuest', [
    new TableEntry(1, 80, 'Defeat Competition'),
    new TableEntry(1, 80, 'Find Vendors')
  ])

  const scenario = new Scenario('Wilderness Trek', getRng(0.5, 72))

  // When you encounter a Goblin Band, roll on the Combat Resolution table
  scenario.add(new ScenarioEvent('Encounters', 'Goblin Band', [
    new Outcome(1, 'CombatResolution')
  ]))

  scenario.add(new ScenarioEvent('Encounters', 'Wolf Pack', [
    new Outcome(1, 'CombatResolution')
  ]))

  // When you meet a Merchant, you might trade or get a quest
  scenario.add(new ScenarioEvent('Encounters', 'Traveling Merchant', [
    new Outcome(0.6, 'TradeGoods'),
    new Outcome(0.4, 'MerchantQuest')
  ]))

  new Table('Defeat', [
    new TableEntry(1, 80, 'You And The Entire Team Died'),
    new TableEntry(81, 100, 'You Died')
  ])

  new Table('StandardVictory', [
    new TableEntry(1, 80, 'Severely Wounded But Standing'),
    new TableEntry(81, 100, 'Slightly Damaged But Victorious')
  ])

  new Table('PyrrhicVictory', [
    new TableEntry(1, 80, 'All But You Are Dead'),
    new TableEntry(81, 100, 'You Have Lost Limbs')
  ])

  new Table('TriumphantVictory', [
    new TableEntry(1, 80, 'Breathlessly Easy Victory'),
    new TableEntry(81, 100, 'The Dragon Surrendered')
  ])

  scenario.add(new ScenarioEvent('Encounters', 'Ancient Dragon', [
    new Outcome(1, 'PyrrhicVictory', [
      { name: 'danger', minValue: 10 }
    ]),
    
    // If treasure >= 15, they're wealthy enough to hire help - good ending
    new Outcome(1, 'TriumphantVictory', [
      { name: 'treasure', minValue: 15 }
    ]),
    
    // Otherwise, standard victory
    new Outcome(0.1, 'StandardVictory'),

    new Outcome(0.9, 'Defeat')
  ]))

  const { path } = scenario.run()

  assert.is(path[0].roll, 73)
  assert.is(path[0].tableName, 'Encounters')
  assert.is(path[0].entry, 'Ancient Dragon')
  assert.is(path[0].tags.get('combat'), 5)
  assert.is(path[0].tags.get('legendary'), 1)

  assert.is(path[1].roll, 73)
  assert.is(path[1].tableName, 'Defeat')
  assert.is(path[1].entry, 'You And The Entire Team Died')
  assert.is(path[1].tags.get('combat'), 5)
  assert.is(path[1].tags.get('legendary'), 1)
})

scenarioTests('third test', () => {
  const rng = new SimpleSeededRNG('epic-quest-seed')
  const scenario = new Scenario('The Dragon Heist', rng)

  // Act 1: The Hook
  new Table('QuestStart', [
    new TableEntry(1, 50, 'Tavern Rumor', [
      new Tag('info', 1)
    ]),
    new TableEntry(51, 100, 'Desperate Plea', [
      new Tag('urgency', 2)
    ])
  ])

  // Act 2: Investigation or Combat approach
  scenario.add(new ScenarioEvent('QuestStart', 'Tavern Rumor', [
    new Outcome(0.7, 'Investigation'),
    new Outcome(0.3, 'DirectConfrontation')
  ]))

  scenario.add(new ScenarioEvent('QuestStart', 'Desperate Plea', [
    new Outcome(0.9, 'DirectConfrontation'),  // Urgency drives combat
    new Outcome(0.1, 'Investigation')
  ]))

  // Investigation accumulates info
  new Table('Investigation', [
    new TableEntry(1, 100, 'Gather Clues', [
      new Tag('info', 3)
    ])
  ])

  // Combat accumulates danger
  new Table('DirectConfrontation', [
    new TableEntry(1, 100, 'Fight Guards', [
      new Tag('danger', 2)
    ])
  ])

  new Table('StandardVictory', [
    new TableEntry(1, 80, 'Severely Wounded But Standing'),
    new TableEntry(81, 100, 'Slightly Damaged But Victorious')
  ])

  new Table('CleverVictory', [
    new TableEntry(1, 80, 'You Outwitted Them'),
    new TableEntry(81, 100, 'They Were Deceived')
  ])

  new Table('BrutalVictory', [
    new TableEntry(1, 80, 'Your Enemy Has Been Completely Liquidated'),
    new TableEntry(81, 100, 'Your Enemy Has Surrendered Out Of Terror')
  ])

  // Act 3: Final confrontation - different outcomes based on your path
  scenario.add(new ScenarioEvent('Investigation', 'Gather Clues', [
    new Outcome(1, 'FinalConfrontation')
  ]))

  scenario.add(new ScenarioEvent('DirectConfrontation', 'Fight Guards', [
    new Outcome(1, 'FinalConfrontation')
  ]))

  new Table('FinalConfrontation', [
    new TableEntry(1, 100, 'Face the Dragon', [])
  ])

  scenario.add(new ScenarioEvent('FinalConfrontation', 'Face the Dragon', [
    // High info = you know the dragon's weakness
    new Outcome(1, 'CleverVictory', [
      { name: 'info', minValue: 4 }
    ]),
    
    // High danger = injured but victorious
    new Outcome(1, 'BrutalVictory', [
      { name: 'danger', minValue: 4 }
    ]),
    
    // Balanced approach
    new Outcome(1, 'StandardVictory')
  ]))

  const { path } = scenario.run()
  
  assert.is(path[0].roll, 87)
  assert.is(path[0].tableName, 'QuestStart')
  assert.is(path[0].entry, 'Desperate Plea')
  assert.is(path[0].tags.get('urgency'), 2)

  assert.is(path[1].roll, 94)
  assert.is(path[1].tableName, 'DirectConfrontation')
  assert.is(path[1].entry, 'Fight Guards')
  assert.is(path[1].tags.get('urgency'), 2)
  assert.is(path[1].tags.get('danger'), 2)

  assert.is(path[2].roll, 69)
  assert.is(path[2].tableName, 'FinalConfrontation')
  assert.is(path[2].entry, 'Face the Dragon')
  assert.is(path[2].tags.get('urgency'), 2)
  assert.is(path[2].tags.get('danger'), 2)

  assert.is(path[3].roll, 59)
  assert.is(path[3].tableName, 'StandardVictory')
  assert.is(path[3].entry, 'Severely Wounded But Standing')
  assert.is(path[2].tags.get('urgency'), 2)
  assert.is(path[2].tags.get('danger'), 2)
})

scenarioTests('fourth test', () => {
  const rng = new SimpleSeededRNG('room-moving')
  const scenario = new Scenario('The Hallways', rng)

  new Table('RoomOne', [
    new TableEntry(1, 100, 'Trapped Corridor', [
      new Tag('danger', 1)
    ])
  ])

  new Table('RoomTwo', [
    new TableEntry(1, 100, 'Guard Post', [
      new Tag('danger', 2)
    ])
  ])

  new Table('RoomThree', [
    new TableEntry(1, 100, 'Armory', [
      new Tag('danger', 2)
    ])
  ])

  new Table('BossRoom', [
    new TableEntry(1, 100, 'Ancient Guardian', [])
  ])

  new Table('HardModeBoss', [
    new TableEntry(1, 90, 'You Lost', []),
    new TableEntry(91, 100, 'You won', [])
  ])

  new Table('NormalBoss', [
    new TableEntry(1, 40, 'You Lost', []),
    new TableEntry(41, 100, 'You won', [])
  ])

  scenario.add(new ScenarioEvent('RoomOne', 'Trapped Corridor', [
    new Outcome(1, 'RoomTwo')
  ]))

  scenario.add(new ScenarioEvent('RoomTwo', 'Guard Post', [
    new Outcome(1, 'RoomThree')
  ]))

  scenario.add(new ScenarioEvent('RoomThree', 'Armory', [
    new Outcome(1, 'BossRoom')
  ]))

  // danger accumulates to 5, triggering hard mode boss
  scenario.add(new ScenarioEvent('BossRoom', 'Ancient Guardian', [
    new Outcome(1, 'HardModeBoss', [
      { name: 'danger', minValue: 5 }
    ]),
    new Outcome(1, 'NormalBoss')
  ]))

  const { path } = scenario.run()

  assert.is(path[0].roll, 91)
  assert.is(path[0].tableName, 'RoomOne')
  assert.is(path[0].entry, 'Trapped Corridor')
  assert.is(path[0].tags.get('danger'), 1)

  assert.is(path[1].roll, 39)
  assert.is(path[1].tableName, 'RoomTwo')
  assert.is(path[1].entry, 'Guard Post')
  assert.is(path[1].tags.get('danger'), 3)

  assert.is(path[2].roll, 81)
  assert.is(path[2].tableName, 'RoomThree')
  assert.is(path[2].entry, 'Armory')
  assert.is(path[2].tags.get('danger'), 5)

  assert.is(path[3].roll, 66)
  assert.is(path[3].tableName, 'BossRoom')
  assert.is(path[3].entry, 'Ancient Guardian')
  assert.is(path[3].tags.get('danger'), 5)

  assert.is(path[4].roll, 31)
  assert.is(path[4].tableName, 'HardModeBoss')
  assert.is(path[4].entry, 'You Lost')
  assert.is(path[4].tags.get('danger'), 5)
})

scenarioTests.run()
