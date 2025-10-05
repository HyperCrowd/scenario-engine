import Outcome from './outcome'

/**
 * Represents an Event, linking a specific Table and Entry name to possible Outcomes.
 */
export default class ScenarioEvent {
  /** The name of the Table this event is tied to */
  tableName: string
  /** The name of the Entry in the Table */
  entryName: string
  /** Array of possible outcomes from this event */
  outcomes: Outcome[]

  /**
   * @param tableName - Name of the Table this event is tied to
   * @param entryName - Name of the Entry in the Table
   * @param outcomes - Array of possible outcomes from this event
   */
  constructor(tableName: string, entryName: string, outcomes: Outcome[]) {
    this.tableName = tableName
    this.entryName = entryName
    this.outcomes = outcomes
  }
}
