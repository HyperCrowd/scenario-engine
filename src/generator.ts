import { promises as fs } from 'fs'
import Tag from './tag'
import TableEntry from './tableEntry'
import Scenario from './scenario'
import Outcome from './outcome'
import ScenarioEvent from './scenarioEvent'
import path from 'path'

type Requirement = {
  name: string,
  minValue: number
}

/**
 * 
 */
async function openMarkdownFile(filePath: string): Promise<string> {
  const absolutePath = path.resolve(filePath)
  const content = await fs.readFile(absolutePath, 'utf-8')
  return content
}

function generateTable() {}

function generateScenario() {}

/**
 * 
 */
function generateTag(tagString: string) {
  const result: Tag[] = []
  const tags = tagString.split(',').map(tags => tags.trim())

  for (const tag of tags) {
    const [name, value] = tag.split(':')
    result.push(new Tag(name, Number(value)))
  }

  return result
}

/**
 * 
 */
function generateTableEntry(roll: string, name: string, description: string = '', tags: Tag[]) {
  let [ startText, endText ] = roll.split('-')

  if (endText === undefined) {
    endText = startText
  }

  const result = new TableEntry(Number(startText), Number(endText), name, description, tags)
  return result
}

/**
 * 
 */
function generateRequirement(requirementString: string) {
  const result: Requirement[] = []
  const tags = requirementString.split(',').map(tags => tags.trim())

  for (const tag of tags) {
    const [name, value] = tag.split(':')
    result.push({ name, minValue: Number(value) })
  }

  return result
}

/**
 * 
 */
function generateOutcome(likelihood: string, tableName: string, TagThresholdString) {
  const thresholds = generateRequirement(TagThresholdString)
  const outcome = new Outcome(parseFloat(likelihood), tableName, thresholds)
  return outcome
}

/**
 * 
 */
function generateScenarioEvent(tableName: string, entryName: string, outcomes: Outcome[]) {
  const result = new ScenarioEvent(tableName, entryName, outcomes)
  return result
}

/**
 * 
 * @param filePath 
 */
export async function generate (filePath: string) {
  const lines = await openMarkdownFile(filePath)
  const tables: Record<string, TableEntry[]> = {}
  const scenarios: Record<string, Scenario> = {}
  const requirements: {
    table: string,
    entry: string,
    requirements: string
  }[] = []

  let isTableDefinition: string | boolean = false
  let isScenarioDefinition: string | boolean = false

  for (const line of lines.split('\n')) {
    if (line.trim() === '') {
      isTableDefinition = false
      isScenarioDefinition = false
      continue
    }

    if (isTableDefinition === false) {
      if (line.substring(0, 2) === '# ') {
        const [name] = line.split(':')
        isTableDefinition = name.substring(2).trim()

        if (tables[isTableDefinition] === undefined) {
          tables[isTableDefinition] = []
        }
      }
    }

    if (isScenarioDefinition === false) {
      if (line.substring(0, 12) === '## Scenario:') {
        const [, scenario] = line.split(':')
        isScenarioDefinition = scenario.trim()

        if (scenarios[isScenarioDefinition] === undefined) {
          scenarios[isScenarioDefinition] = new Scenario(isScenarioDefinition)
        }
      }
    }
    
    if (line.substring(0, 1) === '|') {
      if (
        line.indexOf('|-') > -1 ||
        line.indexOf('-|') > -1 ||
        line.toLowerCase() === '|roll|outcome|tags|requires|description|' ||
        line.toLowerCase() === '|from|entry|go to|likelihood|requires|'
      ) {
        // Header, ignore
        continue
      } else {
        // Piped definitions
        if (isTableDefinition) {
          const [, roll, entry, tagString, requirementString, description] = line.split('|')
          const tags = generateTag(tagString)
          requirements.push({
            table: isTableDefinition,
            entry,
            requirements: requirementString
          })
          const tableEntry = generateTableEntry(roll, entry, description, tags)
          tables[isTableDefinition].push(tableEntry)
        } else if (isScenarioDefinition) {
          const scenario = scenarios[isScenarioDefinition]
          const [, from, entry, goTo, likelihood, thresholds] = line.split('|')

          const entries = entry === '*'
            ? tables[from].map(e => e.name)
            : entry.split(',')

          for (const entryName of entries) {
            const outcome = [generateOutcome(likelihood, goTo, thresholds)]
            const event = generateScenarioEvent(from, entryName, outcome)
            scenario.add(event)
          }

        }
      }
    }

    for (const name of Object.keys(scenarios)) {
      const scenario = scenarios[name]

      for (const item of requirements) {
        const { table, entry, requirements } = item
        const existingEvent = scenario.getEvent(table, entry)

        if (existingEvent !== undefined) {
          // scenario.mergeOutcomes(existingEvent, )
        }
      }
    }
            


    // @TODO update the requirements side
  }
  // console.log('tables')
  // console.log(tables)

  // console.log('scenario events')
  // console.log(scenarios['Generate World'].events)

  // console.log('requirements')
  // console.log(requirements)
}