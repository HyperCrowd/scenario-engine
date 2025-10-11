import Tag from './tag'
import TableManager from './tableManager'
import ScenarioEvent from './scenarioEvent'
import Outcome from './outcome'
import SimpleSeededRNG from './rng'
import Table from './table'
import Journey, { type JourneyTags, type PathEvent } from './journey'

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
  journey: Journey

  /**
   * Constructor
   */
  constructor(name: string, rng: SimpleSeededRNG = new SimpleSeededRNG(), journey: Journey = new Journey()) {
    this.name = name
    this.rng = rng
    this.events = []
    this.journey = journey
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
  private getEntry (table: Table, journey: Journey = this.journey) {
    const roll = this.rng.randomInt(0, table.getMaxValue()) + 1
    const entry = table.getEntry(roll)

    if (!entry) {
      throw new Error(`No entry found for roll ${roll} in table "${table.name}".`)
    }

    if (entry.tags && entry.tags.length > 0) {
      const tags = Tag.unwrap(journey, entry.tags)
      for (const tag of tags) {
        journey.addTag(tag)
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

  /**
   * Gets possible outcomes based on how the Journey and the Scenario Event intersect
   */
  private getPossibleOutcomes (scenarioEvent: ScenarioEvent, journey: Journey = this.journey) {
    const hasThresholds = scenarioEvent.outcomes.filter(outcome => {
      return outcome.tagThresholds && outcome.tagThresholds.length > 0
    }).length > 0

    const possibleOutcomes: Outcome[] = scenarioEvent.outcomes.filter(outcome => {
      if (hasThresholds) {
        // This scenario event has thresholds, use them
        if (!outcome.tagThresholds || outcome.tagThresholds.length === 0) {
          return false
        }

        return journey.isActivated(outcome.tagThresholds)
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
  private getNextOutcome(scenarioEvent: ScenarioEvent, criteria?: { byTableName?: string, randomly?: boolean, byTags?: JourneyTags}): Outcome | undefined {
    let outcome: Outcome | undefined

    if (criteria !== undefined) {
      const journey = new Journey(criteria.byTags ?? new Map<string, number>())
      const possibleOutcomes = this.getPossibleOutcomes(scenarioEvent, journey)

      if (journey.hasTags()) {
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
   * Adds a Path Event to the Journey
   */
  private addPathEvent (tableName: string, journey: Journey = this.journey) {
    const table = this.getTable(tableName)
    const { roll, entry } = this.getEntry(table, journey)
    return journey.addPathEvent(roll, tableName, entry)
  }

  /**
   * Gets an event by Table Entry
   */
  getEvent(tableName: string, entryName: string) {
    return this.events.find(e => e.tableName === tableName && e.entryName === entryName)
  }

  /**
   * Merges outcomes into a Scenario Event
   */
  mergeOutcomes (event: ScenarioEvent, outcomes: Outcome[], addIfMissing = true, journey: Journey = this.journey) {
    for (const outcome of event.outcomes) {
      const existingOutcome = outcomes.find(o => outcome.tableName === o.tableName && outcome.likelihood === o.likelihood)

      if (existingOutcome) {
        // The outcome within the event already exists
        const thresholds = Tag.unwrap(journey, outcome.tagThresholds)
        for (const threshold of thresholds) {
          threshold.apply(journey, existingOutcome.tagThresholds)
        }
      } else {
        // The outcome does not exist, add it
        if (addIfMissing) {
          outcomes.push(outcome)
        }
      }
    }
  }

  /**
   * Registers an Event to the scenario.
   */
  add(event: ScenarioEvent) {
    const existingEvent = this.getEvent(event.tableName, event.entryName)

    if (existingEvent !== undefined) {
      // The event already exists
      this.mergeOutcomes(event, existingEvent.outcomes)
    } else {
      // The event does not exist, add it
      this.events.push(event)
    }
  }


  /**
   * Starts running the scenario from the first registered event.
   */
  run(journey: Journey = this.journey, currentEvent: ScenarioEvent | undefined = this.events[0], path: PathEvent[] = []): Journey {
    if (this.events.length === 0) {
      throw new Error('No events registered in the scenario.')
    }

    const pathEvent = this.addPathEvent(currentEvent.tableName, journey)

    path.push(pathEvent)

    const nextEvent: ScenarioEvent | undefined = this.events.find((e) => pathEvent.tableName === e.tableName && pathEvent.entry === e.entryName)

    if (nextEvent === undefined) {
      // path.push(this.getPathEvent(currentEvent.tableName, accumulatedTags))
      return journey
    }

    const outcome = this.getNextOutcome(nextEvent, {
      byTags: journey.tags,
      randomly: true
    })

    if (outcome) {
      // There is an outcome
      const nextEvents = this.events.filter((e) => e.tableName === outcome.tableName)
      
      if (nextEvents.length > 0) {
        // Go through known scenario events involving this table
        for (const nextEvent of nextEvents) {
          this.run(journey, nextEvent, path)
        }
      } else {
        // We are done
        const pathEvent = this.addPathEvent(outcome.tableName, journey)
        path.push(pathEvent)
      }

      
    }

    return journey
  }
}
