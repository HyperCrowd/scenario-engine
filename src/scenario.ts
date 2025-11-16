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
  /** The journey taken through this scenario */
  journey: Journey
  /** Outputs a journey */
  debug: string = ''

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
  private getNextOutcome(scenarioEvent: ScenarioEvent, criteria?: { byTableName?: string, randomly?: boolean, byTags?: JourneyTags}, journey: Journey = this.journey): Outcome | undefined {
    let outcome: Outcome | undefined

    if (criteria !== undefined) {
      const journey = new Journey(criteria.byTags ?? new Map<string, number>())
      const possibleOutcomes = this.getPossibleOutcomes(scenarioEvent, journey)

      if (possibleOutcomes.length === 0) {
        this.trace('No possible outcomes!')
        return
      }

      if (journey.hasTags() || criteria.randomly) {
        /**
         * Find outcome by tags
         **/
        this.trace(`Getting 1 of ${possibleOutcomes.length} random valid outcome...`)

        const possibleOutcome = this.getRandomOutcome(scenarioEvent, possibleOutcomes)

        if (possibleOutcome) {
          outcome = possibleOutcome
        }
      }     

      if (outcome === undefined && criteria.byTableName) {
        /**
         * Find outcome by table name
         */
        this.trace('Getting outcome by table name...')
        const possibleOutcome = scenarioEvent.outcomes.find((o) => o.tableName === criteria.byTableName)

        if (possibleOutcome) {
          outcome = possibleOutcome
        }
      }
    } else if (criteria === undefined) {
      /**
       * Find outcome by probability
       */
      this.trace('Getting random outcome...')
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
    this.trace(`Adding "${tableName}/${entry.name}" to path`)
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
  mergeOutcomes (newEvent: ScenarioEvent, existingOutcomes: Outcome[], addIfMissing = true) {
    for (const outcome of newEvent.outcomes) {
      const existingOutcome = existingOutcomes.find(
        o => outcome.tableName === o.tableName && outcome.likelihood === o.likelihood
      )

      if (existingOutcome) {
        for (const threshold of outcome.tagThresholds) {
          existingOutcome.tagThresholds.push(threshold)
        }
      } else {
        // The outcome does not exist, add it
        if (addIfMissing) {
          existingOutcomes.push(outcome)
        }
      }
    }
  }

  /**
   * Registers an Event to the scenario.
   */
  add(tableName: string, entryName: string | string[], outcomes: Outcome[] | Record<string, number>) {
    try {
      const normalizedOutcomes: Outcome[] = outcomes instanceof Array
        ? outcomes
        : Object.entries(outcomes).map(([ tableName, likelihood]) => new Outcome(likelihood, tableName))

      const entryNames = entryName instanceof Array
        ? entryName
        : [entryName]

      for (const name of entryNames) {
        const event = new ScenarioEvent(tableName, name, normalizedOutcomes)
        const existingEvent = this.getEvent(event.tableName, event.entryName)

        if (existingEvent !== undefined) {
          // The event already exists
          this.mergeOutcomes(event, existingEvent.outcomes)
        } else {
          // The event does not exist, add it
          this.events.push(event)
        }
      }
    } catch (e) {
      console.log({ outcomes })
      throw e
    }
  }

  /**
   * Tracing
   */
  trace (message: string, object: Object | string = '') {
    if (this.debug !== '') {
      const objMsg = object !== '' ? JSON.stringify(object, null, 2) : ''
      console.log(this.debug, message, objMsg)
    }
  }

  /**
   * Starts running the scenario from the first registered event.
   */
  run(journey: Journey = this.journey, currentEvent: ScenarioEvent | undefined = this.events[0], skipInitialRoll: boolean = false): Journey {
    if (this.events.length === 0) {
      throw new Error('No events registered in the scenario.')
    }

    let pathEvent: PathEvent
    
    if (skipInitialRoll) {
      // We already rolled for this event in the parent call
      this.trace(`Using existing path entry for ${currentEvent.tableName}`)
      pathEvent = journey.path[journey.path.length - 1] // Get the last added path event
    } else {
      // Normal flow: roll on the current event's table
      this.trace(`Adding path for ${currentEvent.tableName}`)
      pathEvent = this.addPathEvent(currentEvent.tableName, journey)
    }

    this.trace(`Searching for "${pathEvent.tableName}/${pathEvent.entry}" event...`)

    const nextEvent = this.events.find((e) =>
      pathEvent.tableName === e.tableName && pathEvent.entry === e.entryName
    )

    if (nextEvent === undefined) {
      this.trace('Could not find it, bailing')
      return journey
    }

    this.trace('Found it!')
    this.trace('Searching for the next outcome with tags:', journey.tags)

    const outcome = this.getNextOutcome(nextEvent, {
      byTags: journey.tags,
      randomly: true
    })

    if (outcome) {
      this.trace('There is a next outcome')
      
      // Roll on the outcome table ONCE
      const nextPathEvent = this.addPathEvent(outcome.tableName, journey)
      
      // Find the SPECIFIC event matching this roll
      const matchedEvent = this.events.find((e) => 
        e.tableName === nextPathEvent.tableName && 
        e.entryName === nextPathEvent.entry
      )
      
      if (matchedEvent) {
        this.trace(`Running matched event: ${matchedEvent.entryName}`)

        if(this.debug !== '') {
          this.debug += '.'
        }

        // Skip the initial roll since we just did it
        journey = this.run(journey, matchedEvent, true)
      } else {
        this.trace(`No event defined for ${nextPathEvent.tableName}/${nextPathEvent.entry}`)
      }
    }

    this.trace(`Returning from event`)
    this.debug = this.debug.slice(0, -1)
    return journey
  }
}
