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
}
