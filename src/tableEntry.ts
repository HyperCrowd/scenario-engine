import Tag, { TagModifier } from './tag.ts'

/**
 * Represents an entry within a Table, defined by a numeric range, name, and optional tags.
 */
export default class TableEntry {
  start: number
  end: number
  name: string
  description: string
  tags: TagModifier | Tag[]

  /**
   * @param start - The starting number of the range (inclusive).
   * @param end - The ending number of the range (inclusive).
   * @param name - The name of the entry.
   * @param tags - Optional array of tags associated with this entry.
   */
  constructor(start: number, end: number, name: string, description: string = name, tags: Tag[] = []) {
    this.start = start
    this.end = end
    this.name = name
    this.description = description
    this.tags = tags
  }

  /**
   * Determines whether a given value falls within this entry's range.
   * @param value - The value to test against the entry's range.
   * @returns True if value is within [start, end], else false.
   */
  matches(value: number): boolean {
    return value >= this.start && value <= this.end
  }
}
