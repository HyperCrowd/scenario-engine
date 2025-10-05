import TableManager from './tableManager'
import TableEntry from './tableEntry'
import ScenarioEvent from './scenarioEvent'
import Outcome from './outcome'
import SimpleSeededRNG from './rng'
import Table from './table'

type Tags = Map<string, number>

type PathEvent = {
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
  constructor(name: string, rng: SimpleSeededRNG = new SimpleSeededRNG()) {
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
   * Gets a random Outcome from a Scenario Event
   */
  private getRandomOutcome(scenarioEvent: ScenarioEvent, outcomes: Outcome[] = scenarioEvent.outcomes): Outcome | false  {
    const cumulative: { outcome: Outcome; cumulativeLikelihood: number }[] = []
    let sum = 0

    for (const outcome of outcomes) {
      sum += outcome.likelihood
      cumulative.push({ outcome, cumulativeLikelihood: sum })
    }

    const rand = this.rng.random() * sum
    const outcome = cumulative.find(({ cumulativeLikelihood }) => rand <= cumulativeLikelihood)?.outcome

    if (!outcome) {
      return false
    }

    return outcome
  }

  private getPossibleOutcomes (scenarioEvent: ScenarioEvent, accumulatedTags: Tags) {
    const hasThresholds = scenarioEvent.outcomes.filter(outcome => {
      return outcome.tagThresholds && outcome.tagThresholds.length > 0
    }).length > 0

    const possibleOutcomes: Outcome[] = scenarioEvent.outcomes.filter(outcome => {
      if (hasThresholds) {
        // This scenario event has thresholds, use them
        if (!outcome.tagThresholds || outcome.tagThresholds.length === 0) {
          return false
        }

        return outcome.tagThresholds.every(({ name, minValue }) => {
          return (accumulatedTags.get(name) || 0) >= minValue
        })
      } else {
        // This scenario event has no thresholds, use them
        return outcome
      }
    })

    if (hasThresholds && possibleOutcomes.length === 0) {
      // All threshold checks have failed, use all non-thresholded outcomesinstead
      return scenarioEvent.outcomes.filter(outcome => {
        return outcome.tagThresholds && outcome.tagThresholds.length === 0
      })
    } else {
      // Return all possible outcomes
      return possibleOutcomes
    }
  }

  /**
   * Gets the next outcome of a Scenario Event
   */
  private getNextOutcome(scenarioEvent: ScenarioEvent, criteria?: { byTableName?: string, randomly?: boolean, byTags?: Tags}): Outcome | undefined {
    let outcome: Outcome | undefined

    if (criteria !== undefined) {
      const accumulatedTags = criteria.byTags ?? new Map<string, number>()
      const possibleOutcomes = this.getPossibleOutcomes(scenarioEvent, accumulatedTags)

      if (accumulatedTags.size > 0) {
        /**
         * Find outcome by tags
         **/
        const possibleOutcome = this.getRandomOutcome(scenarioEvent, possibleOutcomes)

        if (possibleOutcome) {
          outcome = possibleOutcome
        }
      }
      
      if (outcome === undefined && criteria.randomly) {
        /**
         * Find outcome by probability
         */
        const possibleOutcome = this.getRandomOutcome(scenarioEvent, possibleOutcomes)

        if (possibleOutcome) {
          outcome = possibleOutcome
        }
      }
      
      if (outcome === undefined && criteria.byTableName) {
        /**
         * Find outcome by table name
         */
        const possibleOutcome = scenarioEvent.outcomes.find((o) => o.tableName === criteria.byTableName)

        if (possibleOutcome) {
          outcome = possibleOutcome
        }
      }
    } else if (criteria === undefined) {
      /**
       * Find outcome by probability
       */
      const possibleOutcome = this.getRandomOutcome(scenarioEvent)

      if (possibleOutcome) {
        outcome = possibleOutcome
      }

      
    } else {
      throw new Error(`Invalid criterial: ${JSON.stringify(criteria, null, 2)}`)
    }

    return outcome
  }

  /**
   * 
   * @param path 
   * @param currentEvent 
   * @param accumulatedTags 
   */
  private getPathEvent (tableName: string, accumulatedTags: Map<string, number>) {
    const table = this.getTable(tableName)
    const { roll, entry } = this.getEntry(table, accumulatedTags)

    return {
      roll,
      tableName: table.name,
      entry: entry.name,
      tags: new Map(accumulatedTags)
    }
  }

  /**
   * Registers an Event to the scenario.
   */
  add(event: ScenarioEvent) {
    this.events.push(event)
  }


  /**
   * Starts running the scenario from the first registered event.
   * @returns Array of objects representing the path of entries chosen during scenario execution
   */
  run(accumulatedTags: Tags = new Map<string, number>(), currentEvent: ScenarioEvent | undefined = this.events[0], path: PathEvent[] = []): { path: PathEvent[], tags: Tags } {
    if (this.events.length === 0) {
      throw new Error('No events registered in the scenario.')
    }

    const pathEvent = this.getPathEvent(currentEvent.tableName, accumulatedTags)

    path.push(pathEvent)

    const nextEvent: ScenarioEvent | undefined = this.events.find((e) => pathEvent.tableName === e.tableName && pathEvent.entry === e.entryName)

    if (nextEvent === undefined) {
      // path.push(this.getPathEvent(currentEvent.tableName, accumulatedTags))
      return { path, tags: accumulatedTags }
    }

    const outcome = this.getNextOutcome(nextEvent, {
      byTags: accumulatedTags,
      randomly: true
    })

    if (outcome) {
      // There is an outcome
      const nextEvents = this.events.filter((e) => e.tableName === outcome.tableName)
      
      if (nextEvents.length > 0) {
        // Go through known scenario events involving this table
        for (const nextEvent of nextEvents) {
          this.run(accumulatedTags, nextEvent, path)
        }
      } else {
        // We are done
        path.push(this.getPathEvent(outcome.tableName, accumulatedTags))
      }

      
    }

    return {
      path,
      tags: accumulatedTags
    }
  }
}
