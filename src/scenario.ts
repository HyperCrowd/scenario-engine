import TableManager from './tableManager'
import TableEntry from './tableEntry'
import ScenarioEvent from './scenarioEvent'
import Outcome, { TagThreshold } from './outcome'

/**
 * Represents a Scenario which chains table entries through Events and Outcomes.
 */
export default class Scenario {
  /** Name of the scenario */
  name: string
  /** RNG providing random() and randomInt(max) */
  rng: { random(): number; randomInt(max: number): number }
  /** Registered events in this scenario */
  events: ScenarioEvent[]

  /**
   * @param name - Name of the scenario
   * @param rng - RNG with random() and randomInt(max) methods
   */
  constructor(name: string, rng: { random(): number; randomInt(max: number): number }) {
    this.name = name
    this.rng = rng
    this.events = []
  }

  /**
   * Registers an Event to the scenario.
   * @param event - Event to register
   */
  register(event: ScenarioEvent) {
    this.events.push(event)
  }

  /**
   * Starts running the scenario from the first registered event.
   * @returns Array of objects representing the path of entries chosen during scenario execution
   */
  async create(): Promise<Array<{
    tableName: string
    entry: TableEntry
    accumulatedTags: Map<string, number>
  }>> {
    if (this.events.length === 0) {
      throw new Error('No events registered in the scenario.')
    }

    const path: Array<{
      tableName: string
      entry: TableEntry
      accumulatedTags: Map<string, number>
    }> = []

    const accumulatedTags = new Map<string, number>()

    let currentEvent: ScenarioEvent | undefined = this.events[0]

    while (currentEvent) {
      const table = TableManager.getTable(currentEvent.tableName)
      if (!table) {
        console.warn(`Table "${currentEvent.tableName}" not found.`)
        break
      }

      const roll = this.rng.randomInt(table.getMaxValue()) + 1
      const entry = table.getEntry(roll)

      if (!entry) {
        console.warn(`No entry found for roll ${roll} in table "${table.name}".`)
        break
      }

      if (entry.tags && entry.tags.length > 0) {
        for (const tag of entry.tags) {
          accumulatedTags.set(tag.name, (accumulatedTags.get(tag.name) || 0) + tag.value)
        }
      }

      path.push({
        tableName: table.name,
        entry,
        accumulatedTags: new Map(accumulatedTags)
      })

      // Find the event that matches current table and entry
      currentEvent = this.events.find(
        e => e.tableName === table.name && e.entryName === entry.name
      )

      if (!currentEvent) {
        break
      }

      // Determine next outcome by tag thresholds first
      let nextOutcome = currentEvent.outcomes.find(outcome => {
        if (!outcome.tagThresholds || outcome.tagThresholds.length === 0) return false
        return outcome.tagThresholds.every(({ name, minValue }) => {
          return (accumulatedTags.get(name) || 0) >= minValue
        })
      })

      if (nextOutcome) {
        currentEvent = this.events.find(e => e.tableName === nextOutcome?.tableName)
        if (!currentEvent) break
        continue
      }

      // Likelihood-based outcome selection
      const cumulative: { outcome: Outcome; cumulativeLikelihood: number }[] = []
      let sum = 0
      for (const outcome of currentEvent.outcomes) {
        if (outcome.tagThresholds && outcome.tagThresholds.length > 0) continue
        sum += outcome.likelihood
        cumulative.push({ outcome, cumulativeLikelihood: sum })
      }

      if (sum === 0) break

      const rand = this.rng.random() * sum
      nextOutcome = cumulative.find(({ cumulativeLikelihood }) => rand <= cumulativeLikelihood)?.outcome
      if (!nextOutcome) break

      currentEvent = this.events.find(e => e.tableName === nextOutcome.tableName)
      if (!currentEvent) break
    }

    return path
  }
}
