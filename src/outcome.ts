import Tag, { TagModifier } from './tag'

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
  tagThresholds: (TagModifier | Tag)[] = []

  /**
   * Creates a new Outcome instance.
   * @param likelihood - Probability between 0 and 1 for this outcome.
   * @param tableName - Name of the table to move to if triggered.
   * @param tagThresholds - Optional array of tag thresholds to trigger this outcome.
   */
  constructor(likelihood: number, tableName: string, tagThresholds: (TagModifier | Tag | Record<string, number>)[] | Record<string, number> = []) {
    this.likelihood = likelihood
    this.tableName = tableName
    const thresholds: (TagModifier | Tag)[] = []

    if (tagThresholds instanceof Array) {
      for (const tag of tagThresholds) {
        if (tag instanceof Function || tag instanceof Tag) {
          thresholds.push(tag)
        } else {
          for (const [name, value] of Object.entries(tag))
            thresholds.push(new Tag(name, value))
          }
      }
    } else {
      for (const [name, value] of Object.entries(tagThresholds)) {
        thresholds.push(new Tag(name, value))
      }
    }

    this.tagThresholds = thresholds
  }
}
