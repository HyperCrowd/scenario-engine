import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import Scenario from '../src/scenario'
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
    new TableEntry(1, 60, 'Village Tavern', '', {
      safe: 1
    }),
    new TableEntry(61, 100, 'Dark Forest', '', {
      danger: 2
    })
  ])

  new Table('TavernEvents', [
    new TableEntry(1, 50, 'Meet Friendly NPC', '', {
      safe: 1
    }),
    new TableEntry(51, 100, 'Overhear Quest Hook', '', {
      intrigue: 1
    })
  ])

  new Table('ForestEvents', [
    new TableEntry(1, 70, 'Goblin Ambush', '', {
      danger: 2
    }),
    new TableEntry(71, 100, 'Ancient Ruins', '', {
      treasure: 1
    })
  ])

  // Create the scenario with seeded RNG
  const scenario = new Scenario('Village Quest', rng)

  // Chain the tables: "When you roll 'Village Tavern', go to TavernEvents"
  scenario.add('QuestStart', 'Village Tavern', {
    TavernEvents: 1
  })

  scenario.add('QuestStart', 'Dark Forest', {
    ForestEvents: 1
  })

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
    new TableEntry(1, 40, 'Goblin Band', '', [
      new Tag('combat', 1)
    ]),
    new TableEntry(41, 60, 'Traveling Merchant', '', [
      new Tag('gold', 5)
    ]),
    new TableEntry(61, 70, 'Wolf Pack', '', [
      new Tag('combat', 2)
    ]),
    new TableEntry(71, 100, 'Ancient Dragon', '', [new 
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
  scenario.add('Encounters', 'Goblin Band', [
    new Outcome(1, 'CombatResolution')
  ])

  scenario.add('Encounters', 'Wolf Pack', [
    new Outcome(1, 'CombatResolution')
  ])

  // When you meet a Merchant, you might trade or get a quest
  scenario.add('Encounters', 'Traveling Merchant', [
    new Outcome(0.6, 'TradeGoods'),
    new Outcome(0.4, 'MerchantQuest')
  ])

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

  scenario.add('Encounters', 'Ancient Dragon', [
    new Outcome(1, 'PyrrhicVictory', [
      new Tag('danger', 10)
    ]),
    
    // If treasure >= 15, they're wealthy enough to hire help - good ending
    new Outcome(1, 'TriumphantVictory', [
      new Tag('treasure', 15)
    ]),
    
    // Otherwise, standard victory
    new Outcome(0.1, 'StandardVictory'),

    new Outcome(0.9, 'Defeat')
  ])

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
    new TableEntry(1, 50, 'Tavern Rumor', '', [
      new Tag('info', 1)
    ]),
    new TableEntry(51, 100, 'Desperate Plea', '', [
      new Tag('urgency', 2)
    ])
  ])

  // Act 2: Investigation or Combat approach
  scenario.add('QuestStart', 'Tavern Rumor', [
    new Outcome(0.7, 'Investigation'),
    new Outcome(0.3, 'DirectConfrontation')
  ])

  scenario.add('QuestStart', 'Desperate Plea', [
    new Outcome(0.9, 'DirectConfrontation'),  // Urgency drives combat
    new Outcome(0.1, 'Investigation')
  ])

  // Investigation accumulates info
  new Table('Investigation', [
    new TableEntry(1, 100, 'Gather Clues', '', [
      new Tag('info', 3)
    ])
  ])

  // Combat accumulates danger
  new Table('DirectConfrontation', [
    new TableEntry(1, 100, 'Fight Guards', '', [
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
  scenario.add('Investigation', 'Gather Clues', [
    new Outcome(1, 'FinalConfrontation')
  ])

  scenario.add('DirectConfrontation', 'Fight Guards', [
    new Outcome(1, 'FinalConfrontation')
  ])

  new Table('FinalConfrontation', [
    new TableEntry(1, 100, 'Face the Dragon', '', [])
  ])

  scenario.add('FinalConfrontation', 'Face the Dragon', [
    // High info = you know the dragon's weakness
    new Outcome(1, 'CleverVictory', [
      new Tag('info', 4)
    ]),
    
    // High danger = injured but victorious
    new Outcome(1, 'BrutalVictory', [
      new Tag('danger', 4)
    ]),
    
    // Balanced approach
    new Outcome(1, 'StandardVictory')
  ])

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
    new TableEntry(1, 100, 'Trapped Corridor', '', [
      new Tag('danger', 1)
    ])
  ])

  new Table('RoomTwo', [
    new TableEntry(1, 100, 'Guard Post', '', [
      new Tag('danger', 2)
    ])
  ])

  new Table('RoomThree', [
    new TableEntry(1, 100, 'Armory', '', [
      new Tag('danger', 2)
    ])
  ])

  new Table('BossRoom', [
    new TableEntry(1, 100, 'Ancient Guardian', '', [])
  ])

  new Table('HardModeBoss', [
    new TableEntry(1, 90, 'You Lost', '', []),
    new TableEntry(91, 100, 'You won', '', [])
  ])

  new Table('NormalBoss', [
    new TableEntry(1, 40, 'You Lost', '', []),
    new TableEntry(41, 100, 'You won', '', [])
  ])

  scenario.add('RoomOne', 'Trapped Corridor', [
    new Outcome(1, 'RoomTwo')
  ])

  scenario.add('RoomTwo', 'Guard Post', [
    new Outcome(1, 'RoomThree')
  ])

  scenario.add('RoomThree', 'Armory', [
    new Outcome(1, 'BossRoom')
  ])

  // danger accumulates to 5, triggering hard mode boss
  scenario.add('BossRoom', 'Ancient Guardian', [
    new Outcome(1, 'HardModeBoss', [
      new Tag('danger', 5)
    ]),
    new Outcome(1, 'NormalBoss')
  ])

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

scenarioTests.only('fifth test', () => {
  new Table('World', [
    new TableEntry(1, 33, 'Start', 'The start.', {
      danger: 1
    }),
    new TableEntry(34, 66, 'Middle', 'The middle.', [(journey) => {
      if (journey.hasTag('danger', { equals: 1 })) {
        // If the condition matches, the danger tag in the journey will be added by 1
        return {
          danger: 1
        }
      } else {
        // If it fails, no tags will be modified
        return []
      }
    }]),
    new TableEntry(67, 100, 'End', 'The end.', [(journey) => {
      if (journey.hasPath({ tableName: 'World', entry: 'Middle' })) {
        // If the condition matches, the danger tag in the journey will be added by 2
        return {
          danger: 2
        }
      } else {
        // If it fails, no tags will be modified
        return []
      }
    }])
  ])

  const rng = new SimpleSeededRNG('danger-quest')
  const scenario = new Scenario('The Hallways', rng)

  scenario.add('World', 'Start', [
    new Outcome(1, 'World')
  ])

  scenario.add('World', 'Middle', [
    new Outcome(1, 'World', [(journey) => {
      const result = {}

      if (journey.hasTag('danger', { greaterThan: 2 })) {
        // Add an additional tag to check for because you have to be dangerous and vicious to continue
        result['vicious'] = 1
      }

      return result
    }])
  ])

  const { path, tags } = scenario.run()

  assert.is(tags.get('danger'), 13)

  assert.is(path[0].roll, 3)
  assert.is(path[0].tableName, 'World')
  assert.is(path[0].entry, 'Start')
  assert.is(path[0].description, 'The start.')
  assert.is(path[0].tags.get('danger'), 1)

  assert.is(path[1].roll, 60)
  assert.is(path[1].tableName, 'World')
  assert.is(path[1].entry, 'Middle')
  assert.is(path[1].description, 'The middle.')
  assert.is(path[1].tags.get('danger'), 2)

  assert.is(path[2].roll, 23)
  assert.is(path[2].tableName, 'World')
  assert.is(path[2].entry, 'Start')
  assert.is(path[2].description, 'The start.')
  assert.is(path[2].tags.get('danger'), 3)

  assert.is(path[3].roll, 91)
  assert.is(path[3].tableName, 'World')
  assert.is(path[3].entry, 'End')
  assert.is(path[3].description, 'The end.')
  assert.is(path[3].tags.get('danger'), 5)

  assert.is(path[4].roll, 73)
  assert.is(path[4].tableName, 'World')
  assert.is(path[4].entry, 'End')
  assert.is(path[4].description, 'The end.')
  assert.is(path[4].tags.get('danger'), 7)

  assert.is(path[5].roll, 63)
  assert.is(path[5].tableName, 'World')
  assert.is(path[5].entry, 'Middle')
  assert.is(path[5].description, 'The middle.')
  assert.is(path[5].tags.get('danger'), 7)

  assert.is(path[6].roll, 11)
  assert.is(path[6].tableName, 'World')
  assert.is(path[6].entry, 'Start')
  assert.is(path[6].description, 'The start.')
  assert.is(path[6].tags.get('danger'), 8)

  assert.is(path[7].roll, 72)
  assert.is(path[7].tableName, 'World')
  assert.is(path[7].entry, 'End')
  assert.is(path[7].description, 'The end.')
  assert.is(path[7].tags.get('danger'), 10)

  assert.is(path[8].roll, 2)
  assert.is(path[8].tableName, 'World')
  assert.is(path[8].entry, 'Start')
  assert.is(path[8].description, 'The start.')
  assert.is(path[8].tags.get('danger'), 11)

  assert.is(path[9].roll, 69)
  assert.is(path[9].tableName, 'World')
  assert.is(path[9].entry, 'End')
  assert.is(path[9].description, 'The end.')
  assert.is(path[9].tags.get('danger'), 13)

  assert.is(path[10].roll, 52)
  assert.is(path[10].tableName, 'World')
  assert.is(path[10].entry, 'Middle')
  assert.is(path[10].description, 'The middle.')
  assert.is(path[10].tags.get('danger'), 13)

})

scenarioTests.run()
