import Journey, { type JourneyTags } from './journey'

export type TagModifier = (journey: Journey) => Tag[] | Record<string, number>
export type ComplexTag = (TagModifier | Tag)[] | Record<string, number>
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
   * Syntatic sugar helper
   */
  static normalize (tags: ComplexTag) {
    if (tags instanceof Array) {
      return tags
    } else {
      const result: Tag[] = []

      for (const [ name, value ] of Object.entries(tags)) {
        result.push(new Tag(name, value))
      }

      return result
    }
  }

  /**
   * 
   */
  static unwrap(journey: Journey, tags: ComplexTag) {
    const result: Tag[] = []

    for(const tag of Tag.normalize(tags)) {
      if (tag instanceof Tag) {
        result.push(tag)
      } else {
        const normalized = Tag.normalize(tag(journey)) as Tag[]
        normalized.forEach(tag => result.push(tag))
      }
    }

    return result
  }

  /**
   * 
   */
  apply (journey: Journey, tags: (TagModifier | Tag)[]) {
    const target = Tag.unwrap(journey, tags)

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
