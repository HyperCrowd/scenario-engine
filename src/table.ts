import TableEntry from './tableEntry'
import TableManager from './tableManager'

/**
 * Represents a table of entries that can be queried based on numeric input.
 * Automatically registers itself with the TableManager singleton.
 */
export default class Table {
  name: string
  entries: TableEntry[]

  /**
   * @param name - The unique name of the table.
   * @param entries - Optional array of entries to initialize the table with.
   */
  constructor(name: string, entries: TableEntry[] = []) {
    this.name = name
    this.entries = entries

    // Automatically register with TableManager
    TableManager.registerTable(this)
  }

  /**
   * Adds a new entry to the table.
   * @param entry - The entry to add.
   */
  addEntry(entry: TableEntry): void {
    this.entries.push(entry)
  }

  /**
   * Gets the highest `end` value across all entries in the table.
   * Useful for determining the max rollable number.
   * @returns The maximum end value or 0 if the table is empty.
   */
  getMaxValue(): number {
    if (this.entries.length === 0) return 0
    return Math.max(...this.entries.map(entry => entry.end))
  }

  /**
   * Retrieves the entry that matches a given numeric input.
   * @param value - The number to look up.
   * @returns The matching entry, or null if no match is found.
   */
  getEntry(value: number): TableEntry | null {
    return this.entries.find(entry => entry.matches(value)) ?? null
  }

  /**
   * Returns a string of keys for the table
   */
  static getKeys(tableName: string): string[] {
    const table = TableManager.getTable(tableName)

    if (!table) {
      throw new RangeError(`"${table}" is not a table`)
    }

    return table.entries.map((e) => e.name)
  }
}
