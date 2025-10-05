var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Outcome: () => Outcome,
  Scenario: () => Scenario,
  ScenarioEvent: () => ScenarioEvent,
  SimpleSeededRNG: () => SimpleSeededRNG,
  Table: () => Table,
  TableEntry: () => TableEntry,
  TableManager: () => tableManager_default,
  Tag: () => Tag
});
module.exports = __toCommonJS(index_exports);

// src/table.ts
var Table = class {
  name;
  entries;
  /**
   * @param name - The unique name of the table.
   * @param entries - Optional array of entries to initialize the table with.
   */
  constructor(name, entries = []) {
    this.name = name;
    this.entries = entries;
    tableManager_default.registerTable(this);
  }
  /**
   * Adds a new entry to the table.
   * @param entry - The entry to add.
   */
  addEntry(entry) {
    this.entries.push(entry);
  }
  /**
   * Gets the highest `end` value across all entries in the table.
   * Useful for determining the max rollable number.
   * @returns The maximum end value or 0 if the table is empty.
   */
  getMaxValue() {
    if (this.entries.length === 0) return 0;
    return Math.max(...this.entries.map((entry) => entry.end));
  }
  /**
   * Retrieves the entry that matches a given numeric input.
   * @param value - The number to look up.
   * @returns The matching entry, or null if no match is found.
   */
  getEntry(value) {
    return this.entries.find((entry) => entry.matches(value)) ?? null;
  }
};

// src/tableManager.ts
var TableManager = /* @__PURE__ */ (() => {
  const tables = /* @__PURE__ */ new Map();
  return {
    /**
     * Registers a new table by name.
     */
    registerTable(table) {
      if (!(table instanceof Table)) {
        throw new Error("Only instances of Table can be registered.");
      }
      if (tables.has(table.name)) {
        throw new Error(`Table with name "${table.name}" is already registered.`);
      }
      tables.set(table.name, table);
    },
    /**
     * Retrieves a registered table by name.
     */
    getTable(name) {
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
      tables.clear();
    }
  };
})();
var tableManager_default = TableManager;

// src/scenario.ts
var Scenario = class {
  /** Name of the scenario */
  name;
  /** RNG providing random() and randomInt(max) */
  rng;
  /** Registered events in this scenario */
  events;
  /**
   * @param name - Name of the scenario
   * @param rng - RNG with random() and randomInt(max) methods
   */
  constructor(name, rng) {
    this.name = name;
    this.rng = rng;
    this.events = [];
  }
  /**
   * Registers an Event to the scenario.
   * @param event - Event to register
   */
  register(event) {
    this.events.push(event);
  }
  /**
   * Starts running the scenario from the first registered event.
   * @returns Array of objects representing the path of entries chosen during scenario execution
   */
  async create() {
    if (this.events.length === 0) {
      throw new Error("No events registered in the scenario.");
    }
    const path = [];
    const accumulatedTags = /* @__PURE__ */ new Map();
    let currentEvent = this.events[0];
    while (currentEvent) {
      const table = tableManager_default.getTable(currentEvent.tableName);
      if (!table) {
        console.warn(`Table "${currentEvent.tableName}" not found.`);
        break;
      }
      const roll = this.rng.randomInt(table.getMaxValue()) + 1;
      const entry = table.getEntry(roll);
      if (!entry) {
        console.warn(`No entry found for roll ${roll} in table "${table.name}".`);
        break;
      }
      if (entry.tags && entry.tags.length > 0) {
        for (const tag of entry.tags) {
          accumulatedTags.set(tag.name, (accumulatedTags.get(tag.name) || 0) + tag.value);
        }
      }
      path.push({
        tableName: table.name,
        entry,
        accumulatedTags: new Map(accumulatedTags)
      });
      currentEvent = this.events.find(
        (e) => e.tableName === table.name && e.entryName === entry.name
      );
      if (!currentEvent) {
        break;
      }
      let nextOutcome = currentEvent.outcomes.find((outcome) => {
        if (!outcome.tagThresholds || outcome.tagThresholds.length === 0) return false;
        return outcome.tagThresholds.every(({ name, minValue }) => {
          return (accumulatedTags.get(name) || 0) >= minValue;
        });
      });
      if (nextOutcome) {
        currentEvent = this.events.find((e) => e.tableName === nextOutcome?.tableName);
        if (!currentEvent) break;
        continue;
      }
      const cumulative = [];
      let sum = 0;
      for (const outcome of currentEvent.outcomes) {
        if (outcome.tagThresholds && outcome.tagThresholds.length > 0) continue;
        sum += outcome.likelihood;
        cumulative.push({ outcome, cumulativeLikelihood: sum });
      }
      if (sum === 0) break;
      const rand = this.rng.random() * sum;
      nextOutcome = cumulative.find(({ cumulativeLikelihood }) => rand <= cumulativeLikelihood)?.outcome;
      if (!nextOutcome) break;
      currentEvent = this.events.find((e) => e.tableName === nextOutcome.tableName);
      if (!currentEvent) break;
    }
    return path;
  }
};

// src/scenarioEvent.ts
var ScenarioEvent = class {
  /** The name of the Table this event is tied to */
  tableName;
  /** The name of the Entry in the Table */
  entryName;
  /** Array of possible outcomes from this event */
  outcomes;
  /**
   * @param tableName - Name of the Table this event is tied to
   * @param entryName - Name of the Entry in the Table
   * @param outcomes - Array of possible outcomes from this event
   */
  constructor(tableName, entryName, outcomes) {
    this.tableName = tableName;
    this.entryName = entryName;
    this.outcomes = outcomes;
  }
  /**
   * Example async method to randomly select an outcome based on likelihood
   */
  async selectOutcome() {
    if (this.outcomes.length === 0) return null;
    const total = this.outcomes.reduce((sum, o) => sum + o.likelihood, 0);
    const rand = Math.random() * total;
    let cumulative = 0;
    for (const outcome of this.outcomes) {
      cumulative += outcome.likelihood;
      if (rand <= cumulative) return outcome;
    }
    return this.outcomes[this.outcomes.length - 1];
  }
};

// src/outcome.ts
var Outcome = class {
  /**
   * Probability between 0 and 1 for this outcome.
   */
  likelihood;
  /**
   * Name of the table to move to if this outcome is triggered.
   */
  tableName;
  /**
   * Optional array of tag thresholds required to trigger this outcome.
   * Each threshold includes a tag name and its minimum required value.
   */
  tagThresholds;
  /**
   * Creates a new Outcome instance.
   * @param likelihood - Probability between 0 and 1 for this outcome.
   * @param tableName - Name of the table to move to if triggered.
   * @param tagThresholds - Optional array of tag thresholds to trigger this outcome.
   */
  constructor(likelihood, tableName, tagThresholds = []) {
    this.likelihood = likelihood;
    this.tableName = tableName;
    this.tagThresholds = tagThresholds;
  }
};

// src/tableEntry.ts
var TableEntry = class {
  start;
  end;
  name;
  tags;
  /**
   * @param start - The starting number of the range (inclusive).
   * @param end - The ending number of the range (inclusive).
   * @param name - The name of the entry.
   * @param tags - Optional array of tags associated with this entry.
   */
  constructor(start, end, name, tags = []) {
    this.start = start;
    this.end = end;
    this.name = name;
    this.tags = tags;
  }
  /**
   * Determines whether a given value falls within this entry's range.
   * @param value - The value to test against the entry's range.
   * @returns True if value is within [start, end], else false.
   */
  matches(value) {
    return value >= this.start && value <= this.end;
  }
};

// src/tag.ts
var Tag = class {
  name;
  value;
  /**
   * @param name - The name of the tag.
   * @param value - The numerical value associated with the tag.
   */
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }
};

// src/rng.ts
var SimpleSeededRNG = class {
  state;
  constructor(seed) {
    if (typeof seed === "string") {
      let h = 1779033703 ^ seed.length;
      for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
      }
      this.state = h >>> 0;
    } else {
      this.state = seed >>> 0;
    }
  }
  /** Returns a float between 0 (inclusive) and 1 (exclusive). */
  random() {
    this.state += 1831565813;
    let t = this.state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  /** Returns an integer between min (inclusive) and max (exclusive). */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min)) + min;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Outcome,
  Scenario,
  ScenarioEvent,
  SimpleSeededRNG,
  Table,
  TableEntry,
  TableManager,
  Tag
});
//# sourceMappingURL=index.cjs.js.map
