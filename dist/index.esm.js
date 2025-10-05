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

// src/rng.ts
var SimpleSeededRNG = class {
  state;
  constructor(seed) {
    if (seed === void 0) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      this.state = array[0];
    } else if (typeof seed === "string") {
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

// src/scenario.ts
var Scenario = class {
  /** Name of the scenario */
  name;
  /** RNG providing random() and randomInt(max) */
  rng;
  /** Registered events in this scenario */
  events;
  /**
   * Constructor
   */
  constructor(name, rng = new SimpleSeededRNG()) {
    this.name = name;
    this.rng = rng;
    this.events = [];
  }
  /**
   * Gets a table
   */
  getTable(tableName) {
    const table = tableManager_default.getTable(tableName);
    if (!table) {
      throw new Error(`Table "${tableName}" not found.`);
    }
    return table;
  }
  /**
   * Gets a Table Entry
   */
  getEntry(table, accumulatedTags) {
    const roll = this.rng.randomInt(0, table.getMaxValue()) + 1;
    const entry = table.getEntry(roll);
    if (!entry) {
      throw new Error(`No entry found for roll ${roll} in table "${table.name}".`);
    }
    if (entry.tags && entry.tags.length > 0) {
      for (const tag of entry.tags) {
        accumulatedTags.set(tag.name, (accumulatedTags.get(tag.name) || 0) + tag.value);
      }
    }
    return {
      roll,
      entry
    };
  }
  /**
   * Registers an Event to the scenario.
   */
  add(event) {
    this.events.push(event);
  }
  /**
   * Gets a random Outcome from a Scenario Event
   */
  getRandomOutcome(scenarioEvent, outcomes = scenarioEvent.outcomes) {
    const cumulative = [];
    let sum = 0;
    for (const outcome2 of outcomes) {
      sum += outcome2.likelihood;
      cumulative.push({ outcome: outcome2, cumulativeLikelihood: sum });
    }
    const rand = this.rng.random() * sum;
    const outcome = cumulative.find(({ cumulativeLikelihood }) => rand <= cumulativeLikelihood)?.outcome;
    if (!outcome) {
      return false;
    }
    return outcome;
  }
  getPossibleOutcomes(scenarioEvent, accumulatedTags) {
    const hasThresholds = scenarioEvent.outcomes.filter((outcome) => {
      return outcome.tagThresholds && outcome.tagThresholds.length > 0;
    }).length > 0;
    const possibleOutcomes = scenarioEvent.outcomes.filter((outcome) => {
      if (hasThresholds) {
        if (!outcome.tagThresholds || outcome.tagThresholds.length === 0) {
          return false;
        }
        return outcome.tagThresholds.every(({ name, minValue }) => {
          return (accumulatedTags.get(name) || 0) >= minValue;
        });
      } else {
        return outcome;
      }
    });
    if (hasThresholds && possibleOutcomes.length === 0) {
      return scenarioEvent.outcomes.filter((outcome) => {
        return outcome.tagThresholds && outcome.tagThresholds.length === 0;
      });
    } else {
      return possibleOutcomes;
    }
  }
  /**
   * Gets the next outcome of a Scenario Event
   */
  getNextOutcome(scenarioEvent, criteria) {
    let outcome;
    if (criteria !== void 0) {
      const accumulatedTags = criteria.byTags ?? /* @__PURE__ */ new Map();
      const possibleOutcomes = this.getPossibleOutcomes(scenarioEvent, accumulatedTags);
      if (accumulatedTags.size > 0) {
        const possibleOutcome = this.getRandomOutcome(scenarioEvent, possibleOutcomes);
        if (possibleOutcome) {
          outcome = possibleOutcome;
        }
      }
      if (outcome === void 0 && criteria.randomly) {
        const possibleOutcome = this.getRandomOutcome(scenarioEvent, possibleOutcomes);
        if (possibleOutcome) {
          outcome = possibleOutcome;
        }
      }
      if (outcome === void 0 && criteria.byTableName) {
        const possibleOutcome = scenarioEvent.outcomes.find((o) => o.tableName === criteria.byTableName);
        if (possibleOutcome) {
          outcome = possibleOutcome;
        }
      }
    } else if (criteria === void 0) {
      const possibleOutcome = this.getRandomOutcome(scenarioEvent);
      if (possibleOutcome) {
        outcome = possibleOutcome;
      }
    } else {
      throw new Error(`Invalid criterial: ${JSON.stringify(criteria, null, 2)}`);
    }
    return outcome;
  }
  /**
   * 
   * @param path 
   * @param currentEvent 
   * @param accumulatedTags 
   */
  getPathEvent(tableName, accumulatedTags) {
    const table = this.getTable(tableName);
    const { roll, entry } = this.getEntry(table, accumulatedTags);
    return {
      roll,
      tableName: table.name,
      entry: entry.name,
      tags: new Map(accumulatedTags)
    };
  }
  /**
   * Starts running the scenario from the first registered event.
   * @returns Array of objects representing the path of entries chosen during scenario execution
   */
  run(accumulatedTags = /* @__PURE__ */ new Map(), currentEvent = this.events[0], path = []) {
    if (this.events.length === 0) {
      throw new Error("No events registered in the scenario.");
    }
    const pathEvent = this.getPathEvent(currentEvent.tableName, accumulatedTags);
    path.push(pathEvent);
    const nextEvent = this.events.find((e) => pathEvent.tableName === e.tableName && pathEvent.entry === e.entryName);
    if (nextEvent === void 0) {
      return { path, tags: accumulatedTags };
    }
    const outcome = this.getNextOutcome(nextEvent, {
      byTags: accumulatedTags,
      randomly: true
    });
    if (outcome) {
      const nextEvents = this.events.filter((e) => e.tableName === outcome.tableName);
      if (nextEvents.length > 0) {
        for (const nextEvent2 of nextEvents) {
          this.run(accumulatedTags, nextEvent2, path);
        }
      } else {
        path.push(this.getPathEvent(outcome.tableName, accumulatedTags));
      }
    }
    return {
      path,
      tags: accumulatedTags
    };
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
  tagThresholds = [];
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
export {
  Outcome,
  Scenario,
  ScenarioEvent,
  SimpleSeededRNG,
  Table,
  TableEntry,
  tableManager_default as TableManager,
  Tag
};
//# sourceMappingURL=index.esm.js.map
