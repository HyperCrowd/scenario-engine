import TableManager from './tableManager'
import TableEntry from './tableEntry'
import ScenarioEvent from './scenarioEvent'
import Outcome from './outcome'
import SimpleSeededRNG from './rng'
import Table from './table'

type Path = {
  tableName: string
  entry: string
  roll: number,
  tags: Map<string, number>
}

/**
 * Represents a Scenario which chains table entries through Events and Outcomes.
 */
export default class Scenario {
  /** Name of the scenario */
  name: string
  /** RNG providing random() and randomInt(max) */
  rng: SimpleSeededRNG
  /** Registered events in this scenario */
  events: ScenarioEvent[]

  /**
   * Constructor
   */
  constructor(name: string, rng: SimpleSeededRNG) {
    this.name = name
    this.rng = rng
    this.events = []
  }

  /**
   * Gets a table
   */
  private getTable (tableName: string)  {
    const table = TableManager.getTable(tableName)

    if (!table) {
      throw new Error(`Table "${tableName}" not found.`)
    }

    return table
  }

  /**
   * Gets a Table Entry
   */
  private getEntry (table: Table, accumulatedTags: Map<string, number>) {
    const roll = this.rng.randomInt(0, table.getMaxValue()) + 1
    const entry = table.getEntry(roll)

    if (!entry) {
      throw new Error(`No entry found for roll ${roll} in table "${table.name}".`)
    }

    if (entry.tags && entry.tags.length > 0) {
      for (const tag of entry.tags) {
        accumulatedTags.set(tag.name, (accumulatedTags.get(tag.name) || 0) + tag.value)
      }
    }

    return {
      roll, entry
    }
  }

  /**
   * Registers an Event to the scenario.
   */
  add(event: ScenarioEvent) {
    this.events.push(event)
  }

  /**
   * Gets a random Outcome from a Scenario Event
   */
  private getRandomOutcome(scenarioEvent: ScenarioEvent) {
    const cumulative: { outcome: Outcome; cumulativeLikelihood: number }[] = []
    let sum = 0

    for (const outcome of scenarioEvent.outcomes) {
      sum += outcome.likelihood
      cumulative.push({ outcome, cumulativeLikelihood: sum })
    }

    if (sum === 0) {
      throw new Error(`Outcome likelihoods are not properly set for the "${scenarioEvent.entryName}" scenario entry`)
    }

    const rand = this.rng.random() * sum
    const outcome = cumulative.find(({ cumulativeLikelihood }) => rand <= cumulativeLikelihood)?.outcome

    if (!outcome) {
      throw new Error(`Somehow, the outcome distributions for "${scenarioEvent.entryName}" are bad.`)
    }

    return outcome
  }

  /**
   * Gets the next outcome of a Scenario Event
   */
  getNextOutcome(scenarioEvent: ScenarioEvent, criteria?: { byTableName?: string, randomly?: boolean, byTags?: Map<string, number> }): Outcome | false {
    let outcome: Outcome | undefined

    if (criteria !== undefined) {
      if (criteria.byTags) {
        /**
         * Find outcome by tags
         **/
        const accumulatedTags = criteria.byTags

        const possibleOutcome = scenarioEvent.outcomes.find(outcome => {
          if (!outcome.tagThresholds || outcome.tagThresholds.length === 0) {
            return false
          }

          return outcome.tagThresholds.every(({ name, minValue }) => {
            return (accumulatedTags.get(name) || 0) >= minValue
          })
        })

        if (possibleOutcome) {
          outcome = possibleOutcome
        }
      }
      
      if (outcome === undefined && criteria.randomly) {
        /**
         * Find outcome by probability
         */
        outcome = this.getRandomOutcome(scenarioEvent)
      }
      
      if (outcome === undefined && criteria.byTableName) {
        /**
         * Find outcome by table name
         */
        const possibleOutcome = scenarioEvent.outcomes.find((o) => o.tableName === criteria.byTableName)

        if (!possibleOutcome) {
          return false
        }

        outcome = possibleOutcome
      }

      if (outcome === undefined) {
        return false
      }
    } else if (criteria === undefined) {
      /**
       * Find outcome by probability
       */
      outcome = this.getRandomOutcome(scenarioEvent)
    } else {
      throw new Error(`Invalid criterial: ${JSON.stringify(criteria, null, 2)}`)
    }

    return outcome
  }

  /**
   * Starts running the scenario from the first registered event.
   * @returns Array of objects representing the path of entries chosen during scenario execution
   */
  run(path: Path[] = [], currentEvent: ScenarioEvent | undefined = this.events[0]): Path[] {
    if (this.events.length === 0) {
      throw new Error('No events registered in the scenario.')
    }

    const accumulatedTags = new Map<string, number>()

    const table = this.getTable(currentEvent.tableName)
    const { roll, entry } = this.getEntry(table, accumulatedTags)

    path.push({
      roll,
      tableName: table.name,
      entry: entry.name,
      tags: new Map(accumulatedTags)
    })

    const outcome = this.getNextOutcome(currentEvent, {
      byTags: accumulatedTags,
      randomly: true
    })

    if (outcome) {
      // There is an outcome
      const nextEvents = this.events.filter((e) => e.tableName === outcome.tableName)
      
      if (nextEvents.length > 0) {
        // Go through known scenario events involving this table
        for (const nextEvent of nextEvents) {
          this.run(path, nextEvent)
        }
      } else {
        // We are done
        const table = this.getTable(outcome.tableName)
        const { roll, entry } = this.getEntry(table, accumulatedTags)

        path.push({
          roll,
          tableName: table.name,
          entry: entry.name,
          tags: new Map(accumulatedTags)
        })
      }

      
    }

    return path
  }
}
