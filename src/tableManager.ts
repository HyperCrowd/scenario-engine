import Table from './table'

/**
 * Singleton manager that keeps track of all registered tables.
 * Tables are registered automatically upon instantiation.
 */
const TableManager = (() => {
  const tables: Map<string, Table> = new Map()

  return {
    /**
     * Registers a new table by name.
     */
    registerTable(table: Table) {
      if (!(table instanceof Table)) {
        throw new Error("Only instances of Table can be registered.")
      }
      
      if (tables.has(table.name)) {
        throw new Error(`Table with name "${table.name}" is already registered.`)
      }
      tables.set(table.name, table)
    },

    /**
     * Retrieves a registered table by name.
     */
    getTable(name: string) {
      return tables.get(name) || null;
    },

    /**
     * Retrieves all registered tables.
     */
    getAllTables() {
      return Array.from(tables.values());
    },

    /**
     * Clears all registered tables.
     * Useful for resetting state between tests.
     */
    clearAll() {
      tables.clear()
    }
  }
})()

export default TableManager
