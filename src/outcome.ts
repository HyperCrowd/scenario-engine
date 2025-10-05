export interface TagThreshold {
  name: string
  minValue: number
}

/**
 * Represents an outcome from an event, pointing to the next table
 * with a given likelihood and optional tag thresholds.
 */
export default class Outcome {
  /**
   * Probability between 0 and 1 for this outcome.
   */
  likelihood: number

  /**
   * Name of the table to move to if this outcome is triggered.
   */
  tableName: string

  /**
   * Optional array of tag thresholds required to trigger this outcome.
   * Each threshold includes a tag name and its minimum required value.
   */
  tagThresholds: TagThreshold[] = []

  /**
   * Creates a new Outcome instance.
   * @param likelihood - Probability between 0 and 1 for this outcome.
   * @param tableName - Name of the table to move to if triggered.
   * @param tagThresholds - Optional array of tag thresholds to trigger this outcome.
   */
  constructor(likelihood: number, tableName: string, tagThresholds: TagThreshold[] = []) {
    this.likelihood = likelihood
    this.tableName = tableName
    this.tagThresholds = tagThresholds
  }
}
