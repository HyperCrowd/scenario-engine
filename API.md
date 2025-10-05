## API Reference

### Scenario

The core class that orchestrates table chaining.

```typescript
new Scenario(name: string, rng: RNG)
```

- `register(event: ScenarioEvent)` - Register an event linking a table entry to outcomes
- `create()` - Execute the scenario, returns path of all rolled entries with accumulated tags

### ScenarioEvent

Defines what happens after rolling a specific entry on a table.

```typescript
new ScenarioEvent(tableName: string, entryName: string, outcomes: Outcome[])
```

- `tableName` - Name of the table this event is for
- `entryName` - Specific entry name that triggers this event
- `outcomes` - Array of possible next steps

### Outcome

Represents a possible next table to roll on.

```typescript
new Outcome(likelihood: number, tableName: string, tagThresholds?: TagThreshold[])
```

- `likelihood` - Probability weight (0-1, or any positive number for relative weights)
- `tableName` - Name of the next table to roll on
- `tagThresholds` - Optional conditions like `[{ name: 'danger', minValue: 5 }]`

**Note**: Outcomes with tag thresholds are evaluated first. If all thresholds are met, that outcome is selected regardless of likelihood.

### Table

A rollable table of entries.

```typescript
new Table(name: string, entries?: TableEntry[])
```

- `addEntry(entry: TableEntry)` - Add an entry
- `getEntry(roll: number)` - Get entry matching the roll
- `getMaxValue()` - Highest possible roll value

### TableEntry

An entry in a table with a roll range.

```typescript
new TableEntry(start: number, end: number, name: string, tags?: Tag[])
```

- `start` - Minimum roll (inclusive)
- `end` - Maximum roll (inclusive)
- `name` - Entry name
- `tags` - Optional tags to accumulate

### Tag

A named value that accumulates during the scenario.

```typescript
new Tag(name: string, value: number)
```

### SimpleSeededRNG

Deterministic random number generator.

```typescript
new SimpleSeededRNG(seed: string | number)
```

- `random()` - Returns float [0, 1)
- `randomInt(min: number, max: number)` - Returns integer [min, max)
