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
  new TableEntry(1, 60, 'Village Tavern', [new Tag('safe', 1)]),
  new TableEntry(61, 100, 'Dark Forest', [new Tag('danger', 2)])
])

new Table('TavernEvents', [
  new TableEntry(1, 50, 'Meet Friendly NPC', [new Tag('safe', 1)]),
  new TableEntry(51, 100, 'Overhear Quest Hook', [new Tag('intrigue', 1)])
])

new Table('ForestEvents', [
  new TableEntry(1, 70, 'Goblin Ambush', [new Tag('danger', 2)]),
  new TableEntry(71, 100, 'Ancient Ruins', [new Tag('treasure', 1)])
])

// Create the scenario with seeded RNG
const scenario = new Scenario('Village Quest', new SimpleSeededRNG('quest-42'))

// Chain the tables: "When you roll 'Village Tavern', go to TavernEvents"
scenario.register(new ScenarioEvent('QuestStart', 'Village Tavern', [
  new Outcome(1, 'TavernEvents')
]))

scenario.register(new ScenarioEvent('QuestStart', 'Dark Forest', [
  new Outcome(1, 'ForestEvents')
]))

// Run the scenario
const path = await scenario.create()

// See what happened
path.forEach(step => {
  console.log(`${step.tableName}: ${step.entry.name}`)
  console.log('Accumulated tags:', Object.fromEntries(step.accumulatedTags))
})
```

To see more examples, check out the [Scenario test](tests/scenario.test.ts)

## How It Works

### 1. Build Your Tables

Each table represents a set of possible outcomes, just like in the DMG:

```typescript
// A wandering monster table
new Table('Encounters', [
  new TableEntry(1, 40, 'Goblin Band', [new Tag('combat', 1)]),
  new TableEntry(41, 70, 'Traveling Merchant', [new Tag('gold', 5)]),
  new TableEntry(71, 90, 'Wolf Pack', [new Tag('combat', 2)]),
  new TableEntry(91, 100, 'Ancient Dragon', [new Tag('combat', 5), new Tag('legendary', 1)])
])
```

### 2. Chain Tables with Events

Events define what happens after rolling a specific entry. This creates the flow of your scenario:

```typescript
const scenario = new Scenario('Wilderness Trek', rng)

// When you encounter a Goblin Band, roll on the Combat Resolution table
scenario.register(new ScenarioEvent('Encounters', 'Goblin Band', [
  new Outcome(1, 'CombatResolution')
]))

// When you meet a Merchant, you might trade or get a quest
scenario.register(new ScenarioEvent('Encounters', 'Traveling Merchant', [
  new Outcome(0.6, 'TradeGoods'),
  new Outcome(0.4, 'MerchantQuest')
]))
```

### 3. Use Tags to Track State

Tags accumulate as you progress through the scenario. They represent anything you want to track:

```typescript
// Combat encounters add danger
new TableEntry(1, 50, 'Orc Ambush', [new Tag('danger', 3)])

// Finding treasure adds wealth
new TableEntry(51, 100, 'Hidden Cache', [new Tag('treasure', 10)])
```

### 4. Unlock Outcomes with Tag Thresholds

Tag thresholds let you unlock special outcomes when accumulated values reach certain levels:

```typescript
scenario.register(new ScenarioEvent('BossFight', 'Defeat the Dragon', [
  // If danger >= 10, the party is too injured - bad ending
  new Outcome(1, 'PyrrhicVictory', [
    { name: 'danger', minValue: 10 }
  ]),
  
  // If treasure >= 15, they're wealthy enough to hire help - good ending
  new Outcome(1, 'TriumphantVictory', [
    { name: 'treasure', minValue: 15 }
  ]),
  
  // Otherwise, standard victory
  new Outcome(1, 'StandardVictory')
]))
```

**Important**: Tag thresholds are checked **before** likelihood-based outcomes. If a threshold is met, that outcome triggers regardless of probability weights.

## The Scenario Flow

When you call `scenario.create()`, here's what happens:

1. **Start** with the first registered event's table
2. **Roll** using the RNG to get a random entry from that table
3. **Accumulate** any tags from the rolled entry
4. **Find** the event matching this table + entry combination
5. **Check** if any outcome's tag thresholds are met
   - If yes → go to that outcome's table
   - If no → use weighted probability to select an outcome
6. **Repeat** steps 2-5 until no more events match

The result is a path through your tables, with all accumulated tags at each step.

## Advanced Patterns

### Complex Branching Quest

```typescript
const rng = new SimpleSeededRNG('epic-quest-seed')
const scenario = new Scenario('The Dragon Heist', rng)

// Act 1: The Hook
new Table('QuestStart', [
  new TableEntry(1, 50, 'Tavern Rumor', [new Tag('info', 1)]),
  new TableEntry(51, 100, 'Desperate Plea', [new Tag('urgency', 2)])
])

// Act 2: Investigation or Combat approach
scenario.register(new ScenarioEvent('QuestStart', 'Tavern Rumor', [
  new Outcome(0.7, 'Investigation'),
  new Outcome(0.3, 'DirectConfrontation')
]))

scenario.register(new ScenarioEvent('QuestStart', 'Desperate Plea', [
  new Outcome(0.9, 'DirectConfrontation'),  // Urgency drives combat
  new Outcome(0.1, 'Investigation')
]))

// Investigation accumulates info
new Table('Investigation', [
  new TableEntry(1, 100, 'Gather Clues', [new Tag('info', 3)])
])

// Combat accumulates danger
new Table('DirectConfrontation', [
  new TableEntry(1, 100, 'Fight Guards', [new Tag('danger', 2)])
])

// Act 3: Final confrontation - different outcomes based on your path
scenario.register(new ScenarioEvent('Investigation', 'Gather Clues', [
  new Outcome(1, 'FinalConfrontation')
]))

scenario.register(new ScenarioEvent('DirectConfrontation', 'Fight Guards', [
  new Outcome(1, 'FinalConfrontation')
]))

new Table('FinalConfrontation', [
  new TableEntry(1, 100, 'Face the Dragon', [])
])

scenario.register(new ScenarioEvent('FinalConfrontation', 'Face the Dragon', [
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

const path = await scenario.create()
```

### Dungeon Crawl with Escalating Danger

```typescript
// Each room adds danger, unlocking harder encounters
new Table('RoomOne', [
  new TableEntry(1, 100, 'Trapped Corridor', [new Tag('danger', 1)])
])

new Table('RoomTwo', [
  new TableEntry(1, 100, 'Guard Post', [new Tag('danger', 2)])
])

new Table('RoomThree', [
  new TableEntry(1, 100, 'Armory', [new Tag('danger', 2)])
])

new Table('BossRoom', [
  new TableEntry(1, 100, 'Ancient Guardian', [])
])

scenario.register(new ScenarioEvent('RoomOne', 'Trapped Corridor', [
  new Outcome(1, 'RoomTwo')
]))

scenario.register(new ScenarioEvent('RoomTwo', 'Guard Post', [
  new Outcome(1, 'RoomThree')
]))

scenario.register(new ScenarioEvent('RoomThree', 'Armory', [
  new Outcome(1, 'BossRoom')
]))

// danger accumulates to 5, triggering hard mode boss
scenario.register(new ScenarioEvent('BossRoom', 'Ancient Guardian', [
  new Outcome(1, 'HardModeBoss', [
    { name: 'danger', minValue: 5 }
  ]),
  new Outcome(1, 'NormalBoss')
]))
```

### Analyzing Scenario Outcomes

```typescript
const path = await scenario.create()

// Get the narrative flow
console.log('=== Quest Path ===')
path.forEach((step, i) => {
  console.log(`${i + 1}. ${step.tableName}: ${step.entry.name}`)
})

// Check final state
const finalStep = path[path.length - 1]
console.log('\n=== Final Tags ===')
finalStep.accumulatedTags.forEach((value, tag) => {
  console.log(`${tag}: ${value}`)
})

// Determine ending type
const dangerLevel = finalStep.accumulatedTags.get('danger') || 0
if (dangerLevel >= 10) {
  console.log('Result: Hard-fought victory with casualties')
} else if (dangerLevel >= 5) {
  console.log('Result: Challenging but successful')
} else {
  console.log('Result: Clean victory')
}
```

## Testing

```bash
npm test
```

Uses [uvu](https://github.com/lukeed/uvu) for fast, lightweight testing.

## Tips for DMs

1. **Start Simple**: Begin with 2-3 tables and grow from there
2. **Use Descriptive Tags**: `danger`, `treasure`, `reputation`, `knowledge`, etc.
3. **Weight Outcomes Carefully**: Remember that tag thresholds override probabilities
4. **Test with Seeds**: Use the same seed to test different scenario paths
5. **Track Everything**: Use tags for anything you might want to reference later
6. **Build Libraries**: Create reusable table collections for different campaign settings
