import Journey, { type JourneyTags } from './journey'

export type TagModifier = (currentTags: Map<string, number>) => Tag[]

/**
 * Represents a tag with a name and a numerical value.
 */
export default class Tag {
  name: string;
  value: number;

  /**
   * @param name - The name of the tag.
   * @param value - The numerical value associated with the tag.
   */
  constructor(name: string, value: number) {
    this.name = name;
    this.value = value;
  }

  /**
   * 
   */
  static unwrap(accumulation: Journey | JourneyTags, tags: TagModifier | Tag[]) {
    return tags instanceof Array
      ? tags
      : tags(accumulation instanceof Map ? accumulation : accumulation.tags)
  }

  /**
   * 
   */
  apply (accumulation: Journey | JourneyTags, tags: TagModifier | Tag[]) {
    const target = Tag.unwrap(accumulation, tags)

    for (const tag of target) {
      if(tag.name === this.name) {
        tag.value += this.value
      }
    }

    return target
  }

  /**
   * 
   */
  update (tags: Tag[]) {
    let didUpdate = false

    tags.forEach(t => {
      if(t.name === this.name) {
        this.value += t.value
        didUpdate = true
      }
    })

    return didUpdate
  }
}
