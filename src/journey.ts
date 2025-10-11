import Tag, { TagModifier } from './tag'

export type JourneyTags = Map<string, number>

export type PathEvent = {
  tableName: string
  entry: string
  roll: number,
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
  hasTags () {
    return this.tags.size > 0
  }

  /**
   * 
   */
  addPathEvent (roll: number, tableName: string, entryName: string) {
    const pathEvent: PathEvent = {
      roll,
      tableName,
      entry: entryName,
      tags: new Map(this.tags)
    }

    this.path.push(pathEvent)

    return pathEvent
  }

  /**
   * 
   */
  addTag (tag: Tag) {
    this.tags.set(tag.name, (this.tags.get(tag.name) || 0) + tag.value)
  }

  /**
   * 
   */
  accumulate (tags: TagModifier | Tag[]) {
    const target = Tag.unwrap(this.tags, tags)

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
    const target = Tag.unwrap(this.tags, tags)

    return target.every(({ name, value }) => {
      return (this.tags.get(name) || 0) >= value
    })
  }
}