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
  /**
   * Returns a string of keys for the table
   */
  static getKeys(tableName) {
    const table = tableManager_default.getTable(tableName);
    if (!table) {
      throw new RangeError(`"${table}" is not a table`);
    }
    return table.entries.map((e) => e.name);
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

// src/tag.ts
var Tag = class _Tag {
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
  /**
   * Syntatic sugar helper
   */
  static normalize(tags) {
    if (tags instanceof Array) {
      return tags;
    } else {
      const result = [];
      for (const [name, value] of Object.entries(tags)) {
        result.push(new _Tag(name, value));
      }
      return result;
    }
  }
  /**
   * 
   */
  static unwrap(journey, tags) {
    const result = [];
    for (const tag of _Tag.normalize(tags)) {
      if (tag instanceof _Tag) {
        result.push(tag);
      } else {
        const normalized = _Tag.normalize(tag(journey));
        normalized.forEach((tag2) => result.push(tag2));
      }
    }
    return result;
  }
  /**
   * 
   */
  apply(journey, tags) {
    const target = _Tag.unwrap(journey, tags);
    for (const tag of target) {
      if (tag.name === this.name) {
        tag.value += this.value;
      }
    }
    return target;
  }
  /**
   * 
   */
  update(tags) {
    let didUpdate = false;
    tags.forEach((t) => {
      if (t.name === this.name) {
        this.value += t.value;
        didUpdate = true;
      }
    });
    return didUpdate;
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
    const thresholds = [];
    if (tagThresholds instanceof Array) {
      for (const tag of tagThresholds) {
        if (tag instanceof Function || tag instanceof Tag) {
          thresholds.push(tag);
        } else {
          for (const [name, value] of Object.entries(tag))
            thresholds.push(new Tag(name, value));
        }
      }
    } else {
      for (const [name, value] of Object.entries(tagThresholds)) {
        thresholds.push(new Tag(name, value));
      }
    }
    this.tagThresholds = thresholds;
  }
};

// src/rng.ts
var SimpleSeededRNG = class {
  state;
  seed;
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
    this.seed = seed;
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

// src/journey.ts
var Journey = class {
  tags;
  path;
  constructor(tags = /* @__PURE__ */ new Map(), path = []) {
    this.tags = tags;
    this.path = path;
  }
  /**
   * 
   */
  getPaths(criteria = {}) {
    const results = this.path.filter((path) => {
      let found = false;
      if (criteria.tableName !== void 0) {
        found = criteria.tableName === path.tableName;
      }
      if (criteria.entry !== void 0) {
        found = criteria.entry === path.entry;
      }
      if (criteria.rollEquals !== void 0) {
        found = criteria.rollEquals === path.roll;
      }
      if (criteria.rollLessThan !== void 0) {
        found = criteria.rollLessThan < path.roll;
      }
      if (criteria.rollGreaterThan !== void 0) {
        found = criteria.rollGreaterThan > path.roll;
      }
      return found;
    });
    return results;
  }
  /**
   * 
   */
  hasPath(criteria = {}, count = 0) {
    const result = this.getPaths(criteria);
    return result.length > count;
  }
  /**
   * 
   */
  hasTag(name, criteria = {}) {
    const value = this.tags.get(name);
    if (value === void 0) {
      return false;
    }
    if (criteria.equals !== void 0) {
      return value === criteria.equals;
    } else if (criteria.lessThan !== void 0) {
      return value < criteria.lessThan;
    } else if (criteria.greaterThan !== void 0) {
      return value > criteria.greaterThan;
    } else {
      return true;
    }
  }
  /**
   *
   */
  hasTags() {
    return this.tags.size > 0;
  }
  /**
   * 
   */
  addPathEvent(roll, tableName, entry) {
    this.accumulate(entry.tags);
    const pathEvent = {
      roll,
      tableName,
      entry: entry.name,
      description: entry.description,
      tags: new Map(this.tags)
    };
    this.path.push(pathEvent);
    return pathEvent;
  }
  /**
   * 
   */
  accumulate(tags) {
    const target = Tag.unwrap(this, tags);
    for (const tag of target) {
      const value = this.tags.get(tag.name) || 0;
      this.tags.set(tag.name, value + tag.value);
    }
    return target;
  }
  /**
   * Is the journey activated?
   */
  isActivated(tags) {
    const normalized = Tag.normalize(tags);
    return normalized.every((tag) => {
      if (tag instanceof Tag) {
        return (this.tags.get(tag.name) || 0) >= tag.value;
      } else {
        return this.isActivated(tag(this));
      }
    });
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
  /** The journey taken through this scenario */
  journey;
  /** Outputs a journey */
  debug = "";
  /**
   * Constructor
   */
  constructor(name, rng = new SimpleSeededRNG(), journey = new Journey()) {
    this.name = name;
    this.rng = rng;
    this.events = [];
    this.journey = journey;
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
  getEntry(table, journey = this.journey) {
    const roll = this.rng.randomInt(0, table.getMaxValue()) + 1;
    const entry = table.getEntry(roll);
    if (!entry) {
      throw new Error(`No entry found for roll ${roll} in table "${table.name}".`);
    }
    return {
      roll,
      entry
    };
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
  /**
   * Gets possible outcomes based on how the Journey and the Scenario Event intersect
   */
  getPossibleOutcomes(scenarioEvent, journey = this.journey) {
    const hasThresholds = scenarioEvent.outcomes.filter((outcome) => {
      return outcome.tagThresholds && outcome.tagThresholds.length > 0;
    }).length > 0;
    const possibleOutcomes = scenarioEvent.outcomes.filter((outcome) => {
      if (hasThresholds) {
        if (!outcome.tagThresholds || outcome.tagThresholds.length === 0) {
          return false;
        }
        return journey.isActivated(outcome.tagThresholds);
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
  getNextOutcome(scenarioEvent, criteria, journey = this.journey) {
    let outcome;
    if (criteria !== void 0) {
      const journey2 = new Journey(criteria.byTags ?? /* @__PURE__ */ new Map());
      const possibleOutcomes = this.getPossibleOutcomes(scenarioEvent, journey2);
      if (possibleOutcomes.length === 0) {
        this.trace("No possible outcomes!");
        return;
      }
      if (journey2.hasTags() || criteria.randomly) {
        this.trace(`Getting 1 of ${possibleOutcomes.length} random valid outcome...`);
        const possibleOutcome = this.getRandomOutcome(scenarioEvent, possibleOutcomes);
        if (possibleOutcome) {
          outcome = possibleOutcome;
        }
      }
      if (outcome === void 0 && criteria.byTableName) {
        this.trace("Getting outcome by table name...");
        const possibleOutcome = scenarioEvent.outcomes.find((o) => o.tableName === criteria.byTableName);
        if (possibleOutcome) {
          outcome = possibleOutcome;
        }
      }
    } else if (criteria === void 0) {
      this.trace("Getting random outcome...");
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
   * Adds a Path Event to the Journey
   */
  addPathEvent(tableName, journey = this.journey) {
    const table = this.getTable(tableName);
    const { roll, entry } = this.getEntry(table, journey);
    this.trace(`Adding "${tableName}/${entry.name}" to path`);
    return journey.addPathEvent(roll, tableName, entry);
  }
  /**
   * Gets an event by Table Entry
   */
  getEvent(tableName, entryName) {
    return this.events.find((e) => e.tableName === tableName && e.entryName === entryName);
  }
  /**
   * Merges outcomes into a Scenario Event
   */
  mergeOutcomes(newEvent, existingOutcomes, addIfMissing = true) {
    for (const outcome of newEvent.outcomes) {
      const existingOutcome = existingOutcomes.find(
        (o) => outcome.tableName === o.tableName && outcome.likelihood === o.likelihood
      );
      if (existingOutcome) {
        for (const threshold of outcome.tagThresholds) {
          existingOutcome.tagThresholds.push(threshold);
        }
      } else {
        if (addIfMissing) {
          existingOutcomes.push(outcome);
        }
      }
    }
  }
  /**
   * Registers an Event to the scenario.
   */
  add(tableName, entryName, outcomes) {
    try {
      const normalizedOutcomes = outcomes instanceof Array ? outcomes : Object.entries(outcomes).map(([tableName2, likelihood]) => new Outcome(likelihood, tableName2));
      const entryNames = entryName instanceof Array ? entryName : [entryName];
      for (const name of entryNames) {
        const event = new ScenarioEvent(tableName, name, normalizedOutcomes);
        const existingEvent = this.getEvent(event.tableName, event.entryName);
        if (existingEvent !== void 0) {
          this.mergeOutcomes(event, existingEvent.outcomes);
        } else {
          this.events.push(event);
        }
      }
    } catch (e) {
      console.log({ outcomes });
      throw e;
    }
  }
  /**
   * Tracing
   */
  trace(message, object = "") {
    if (this.debug !== "") {
      const objMsg = object !== "" ? JSON.stringify(object, null, 2) : "";
      console.log(this.debug, message, objMsg);
    }
  }
  /**
   * Starts running the scenario from the first registered event.
   */
  run(journey = this.journey, currentEvent = this.events[0], skipInitialRoll = false) {
    if (this.events.length === 0) {
      throw new Error("No events registered in the scenario.");
    }
    let pathEvent;
    if (skipInitialRoll) {
      this.trace(`Using existing path entry for ${currentEvent.tableName}`);
      pathEvent = journey.path[journey.path.length - 1];
    } else {
      this.trace(`Adding path for ${currentEvent.tableName}`);
      pathEvent = this.addPathEvent(currentEvent.tableName, journey);
    }
    this.trace(`Searching for "${pathEvent.tableName}/${pathEvent.entry}" event...`);
    const nextEvent = this.events.find(
      (e) => pathEvent.tableName === e.tableName && pathEvent.entry === e.entryName
    );
    if (nextEvent === void 0) {
      this.trace("Could not find it, bailing");
      return journey;
    }
    this.trace("Found it!");
    this.trace("Searching for the next outcome with tags:", journey.tags);
    const outcome = this.getNextOutcome(nextEvent, {
      byTags: journey.tags,
      randomly: true
    });
    if (outcome) {
      this.trace("There is a next outcome");
      const nextPathEvent = this.addPathEvent(outcome.tableName, journey);
      const matchedEvent = this.events.find(
        (e) => e.tableName === nextPathEvent.tableName && e.entryName === nextPathEvent.entry
      );
      if (matchedEvent) {
        this.trace(`Running matched event: ${matchedEvent.entryName}`);
        if (this.debug !== "") {
          this.debug += ".";
        }
        journey = this.run(journey, matchedEvent, true);
      } else {
        this.trace(`No event defined for ${nextPathEvent.tableName}/${nextPathEvent.entry}`);
      }
    }
    this.trace(`Returning from event`);
    this.debug = this.debug.slice(0, -1);
    return journey;
  }
};

// src/tableEntry.ts
var TableEntry = class {
  start;
  end;
  name;
  description;
  tags;
  /**
   * @param start - The starting number of the range (inclusive).
   * @param end - The ending number of the range (inclusive).
   * @param name - The name of the entry.
   * @param tags - Optional array of tags associated with this entry.
   */
  constructor(start, end, name, description = name, tags = []) {
    this.start = start;
    this.end = end;
    this.name = name;
    this.description = description;
    this.tags = Tag.normalize(tags);
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
export {
  Journey,
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
