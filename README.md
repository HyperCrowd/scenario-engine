# Scenario Engine

A TypeScript library for creating dynamic D&D scenarios by chaining random tables together. Build complex, branching adventures where table outcomes flow into new tables, creating emergent narratives driven by accumulated tags and weighted probabilities.

## What is This?

If you've ever used a D&D Dungeon Master's Guide, you've seen random tables: roll a d100, get an encounter. This library lets you **chain those tables together** into scenarios where:

- Rolling on one table determines which table you roll on next
- Tags accumulate throughout the scenario (like gaining "danger" or "treasure")
- Accumulated tags can unlock special outcomes when they reach thresholds
- Weighted probabilities control the flow of the narrative
- Seeded RNG makes scenarios reproducible for testing and sharing

## Use Cases

- **Dynamic Quest Generation** - Create quests that adapt based on player choices
- **Procedural Dungeons** - Generate dungeon encounters that escalate naturally
- **Campaign Events** - Random events that build on previous outcomes
- **NPC Generators** - Create NPCs with backgrounds influenced by tags
- **Loot Tables** - Chain treasure rolls based on enemy types and difficulty
- **Weather Systems** - Evolving weather that influences encounter tables
- **Faction Reputation** - Track reputation and unlock different encounter tables

## Quick Example: A Simple Quest

```typescript
import { Scenario, ScenarioEvent, Outcome, Table, TableEntry, Tag, SimpleSeededRNG } from 'scenario-engine'

// Define your tables (like in a DM's guide)
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
  new TableEntry(51, 100, 'Overhear Quest Hook', [new 
    Tag('intrigue', 1)
  ])
])

new Table('ForestEvents', [
  new TableEntry(1, 70, 'Goblin Ambush', [new 
    Tag('danger', 2)
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
const { path } = await scenario.run()
console.log(path)
```

To see more examples, check out the [Scenario test](tests/scenario.test.ts)

## Installation

```bash
npm install -S https://github.com/HyperCrowd/scenario-engine
```

## How It Works

### 1. Build Your Tables

Each table represents a set of possible outcomes, just like in the DMG. Tags accumulate as you progress through the scenario. They represent anything you want to track:

```typescript
// A wandering monster table
new Table('Encounters', [
  new TableEntry(1, 40, 'Goblin Band', [
    new Tag('combat', 1)
  ]),
  new TableEntry(41, 70, 'Traveling Merchant', [
    new Tag('gold', 5)
  ]),
  new TableEntry(71, 90, 'Wolf Pack', [
    new Tag('combat', 2)
  ]),
  new TableEntry(91, 100, 'Ancient Dragon', [
    new Tag('combat', 5),
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
```

### 2. Chain Tables with Events

Events define what happens after rolling a specific entry. This creates the flow of your scenario:

```typescript
const scenario = new Scenario('Wilderness Trek')

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
```

### 3. Unlock Outcomes with Tag Thresholds

Tag thresholds let you unlock special outcomes when accumulated values reach certain levels:

```typescript
new Table('Defeat', [
  new TableEntry(1, 80, 'You And The Entire Team Died'),
  new TableEntry(1, 80, 'You Died')
])

new Table('StandardVictory', [
  new TableEntry(1, 80, 'Severely Wounded But Standing'),
  new TableEntry(1, 80, 'Slightly Damaged But Victorious')
])

new Table('PyrrhicVictory', [
  new TableEntry(1, 80, 'All But You Are Dead'),
  new TableEntry(1, 80, 'You Have Lost Limbs')
])

new Table('TriumphantVictory', [
  new TableEntry(1, 80, 'Breathlessly Easy Victory'),
  new TableEntry(1, 80, 'The Dragon Surrendered')
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
console.log(path)
```

#### How Tags Work

* When your path lands on a Table Entry that had a tag, that tag and its number accumulates to for the scenario run.
* If a Scenario Event has Outcomes that require Tags to be a minimum value, all of those will be checked agaisnt your accumulated Tag values.
* If there are Outcomes that pass the Tag check, then the possible Outcomes will randomized between those Outcomes where all of their Tags passed the accumulation check.
* If all Tag accumulation checks fail, then the possible Outcomes will be randomized between Outcomes which have no Tags

## The Scenario Flow

When you call `scenario.run()`, here's what happens:

1. **Start** with the first registered event's table
2. **Roll** using the RNG to get a random entry from that table
3. **Accumulate** any tags from the rolled entry
4. **Find** the event matching this table + entry combination
5. **Check** if any outcome's tag thresholds are met
  - If yes → outcomes with met tag threshold are candidates
  - If all no → outcomes with no tag thresholds are candidates
6. **Repeat** steps 2-5 until no more events match

The result is a path through your tables, with all accumulated tags at each step.

## Advanced Patterns

### Complex Branching Quest

```typescript
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
```

### Dungeon Crawl with Escalating Danger

```typescript
// Each room adds danger, unlocking harder encounters
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

```

### Analyzing Scenario Outcomes

```typescript
const { path } = await scenario.run()

// Get the narrative flow
console.log('=== Quest Path ===')
path.forEach((step, i) => {
  console.log(`${i + 1}. ${step.tableName}: ${step.entry}`)
})

// Check final state
const finalStep = path[path.length - 1]
console.log('\n=== Final Tags ===')
finalStep.tags.forEach((value, tag) => {
  console.log(`${tag}: ${value}`)
})

// Establishing conditional overrides for the ending type
const dangerLevel = finalStep.tags.get('danger') || 0
if (dangerLevel >= 10) {
  console.log('Result: Hard-fought victory with casualties')
} else if (dangerLevel >= 5) {
  console.log('Result: Challenging but successful')
} else {
  console.log('Result: Clean victory')
}
```

## Testing

To run the test once:

```bash
npm test
```

To automatically run tests when you update codE:

```bash
npm run dev
```

Uses [uvu](https://github.com/lukeed/uvu) for fast, lightweight testing.

## Tips for DMs

1. **Start Simple**: Begin with 2-3 tables and grow from there
2. **Use Descriptive Tags**: `danger`, `treasure`, `reputation`, `knowledge`, etc.
3. **Weight Outcomes Carefully**: Remember that tag thresholds override probabilities
4. **Test with Seeds**: Use the same seed to test different scenario paths
5. **Track Everything**: Use tags for anything you might want to reference later
6. **Build Libraries**: Create reusable table collections for different campaign settings
