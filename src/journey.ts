import Tag, { TagModifier } from './tag'
import TableEntry from './tableEntry'

export type JourneyTags = Map<string, number>

export type PathEvent = {
  tableName: string
  entry: string
  description: string
  roll: number
  tags: Map<string, number>
}

/**
 * 
 */
export default class Journey {
  tags: JourneyTags
  path: PathEvent[] 

  constructor (tags: JourneyTags = new Map(), path: PathEvent[] = []) {
    this.tags = tags
    this.path = path
  }

  /**
   * 
   */
  getPaths(criteria: { tableName?: string, entry?: string, rollEquals?: number, rollLessThan?: number, rollGreaterThan?: number } = {}) {
    const results = this.path.filter(path => {
      let found = false
      if(criteria.tableName !== undefined) {
        found = criteria.tableName === path.tableName
      }

      if(criteria.entry !== undefined) {
        found = criteria.entry === path.entry
      }

      if(criteria.rollEquals !== undefined) {
        found = criteria.rollEquals === path.roll
      }

      if(criteria.rollLessThan !== undefined) {
        found = criteria.rollLessThan < path.roll
      }

      if(criteria.rollGreaterThan !== undefined) {
        found = criteria.rollGreaterThan > path.roll
      }

      return found
    })

    return results
  }

  /**
   * 
   */
  hasPath (criteria: { tableName?: string, entry?: string, rollEquals?: number, rollLessThan?: number, rollGreaterThan?: number } = {}, count: number = 0) {
    const result = this.getPaths(criteria)

    return result.length > count
  }

  /**
   * 
   */
  hasTag(name: string, criteria: { equals?: number, lessThan?: number, greaterThan?: number } = {}) {
    const value = this.tags.get(name)

    if (value === undefined) {
      return false
    }

    if (criteria.equals !== undefined) {
      return value === criteria.equals
    } else if (criteria.lessThan !== undefined) {
      return value < criteria.lessThan
    } else if (criteria.greaterThan !== undefined) {
      return value > criteria.greaterThan
    } else {
      return true
    }
  }

  /**
   *
   */
  hasTags () {
    return this.tags.size > 0
  }

  /**
   * 
   */
  addPathEvent (roll: number, tableName: string, entry: TableEntry) {
    const pathEvent: PathEvent = {
      roll,
      tableName,
      entry: entry.name,
      description: entry.description,
      tags: new Map(this.tags)
    }

    this.path.push(pathEvent)

    return pathEvent
  }

  /**
   * 
   */
  addTag (tag: Tag | string, value?: number) {
    const actualTag = tag instanceof Tag
      ? tag
      : new Tag(tag, value as number)

    this.tags.set(actualTag.name, (this.tags.get(actualTag.name) || 0) + actualTag.value)
  }

  /**
   * 
   */
  accumulate (tags: TagModifier | Tag[]) {
    const target = Tag.unwrap(this, tags)

    for (const tag of target) {
      const value = this.tags.get(tag.name) || 0
      this.tags.set(tag.name, value + tag.value)
    }

    return target
  }

  /**
   * 
   */
  isActivated (tags: TagModifier | Tag[]) {
    const target = Tag.unwrap(this, tags)

    return target.every(({ name, value }) => {
      return (this.tags.get(name) || 0) >= value
    })
  }
}