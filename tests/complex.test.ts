import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { Table, TableEntry, Scenario, Outcome, SimpleSeededRNG, TableManager } from '../src/index'

const test = suite('Generator')

// Medieval Castle Generator - Proof of Concept (Generator Tone → Regional Population)

// Helper to convert all Maps to arrays recursively
const normalize = (obj: any): any => {
  if (obj instanceof Map) {
    return Array.from(obj.entries())
  }
  if (Array.isArray(obj)) {
    return obj.map(normalize)
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, normalize(v)])
    )
  }
  return obj
}


export interface CastleGenerationResult {
  generatorTone: string
  landOrSea: string
  biome: string
  terrainRoughness: string
  freshwaterSource: string
  regionalPopulation: string
  tags: Map<string, number>
  seed: string | number
  path: Array<{
    roll: number
    tableName: string
    entry: string
    tags: Map<string, number>
  }>
}

export class MedievalCastleGenerator {
  private scenario: Scenario
  private rng: SimpleSeededRNG

  constructor(seed?: string) {
    // Clear any existing tables to avoid registration conflicts
    TableManager.clearAll()
    
    this.rng = new SimpleSeededRNG(seed || `castle_${Date.now()}`)
    console.log(this.rng.seed)
    this.scenario = new Scenario('Medieval Castle Generator', this.rng)
    this.initializeTables()
    this.initializeScenario()
  }

  private initializeTables() {
    // Generator Tone
    new Table('GeneratorTone', [
      new TableEntry(1, 5, 'No Magic'),
      new TableEntry(6, 25, 'Low Fantasy', '', {
        magic: 1,
        lowmagic: 1
      }),
      new TableEntry(26, 100, 'Fantasy', '', {
        magic: 1,
        highmagic: 1
      })
    ])

    // Land or Sea
    new Table('LandOrSea', [
      new TableEntry(1, 75, 'Inland', '', {
        mainland: 1 // Converted from !island
      }),
      new TableEntry(76, 95, 'Coastal', '', {
        coast: 1,
        mainland: 1 // Converted from !island
      }),
      new TableEntry(96, 100, 'Island', '', {
        island: 1
      })
    ])

    // Biome Router - determines which biome table to use
    new Table('BiomeRouter', [
      new TableEntry(1, 50, 'Route to Land Biome'), // mainland tag required
      new TableEntry(51, 100, 'Route to Ocean Biome')  // island tag required
    ])

    // Land Biomes
    new Table('LandBiome', [
      new TableEntry(1, 15, 'Desert', '', {
        hot: 1,
        dry: 1,
        desert: 1
      }),
      new TableEntry(16, 25, 'Hot Savanna', '', {
        hot: 1
      }),
      new TableEntry(26, 35, 'Jungle', '', {
        hot: 1,
        wet: 1
      }),
      new TableEntry(36, 50, 'Prairie', '', {
        dry: 1
      }),
      new TableEntry(51, 65, 'Wooded Grasslands'),
      new TableEntry(66, 80, 'Forest', '', {
        wet: 1
      }),
      new TableEntry(81, 85, 'Tundra', '', {
        cold: 1,
        dry: 1,
        desert: 1
      }),
      new TableEntry(86, 95, 'Taiga', '', {
        cold: 1
      }),
      new TableEntry(96, 100, 'Cold Marsh', '', {
        cold: 1,
        wet: 1
      }),
    ])

    // Ocean Biomes  
    new Table('OceanBiome', [
      new TableEntry(1, 33, 'Cold Ocean', '', {
        cold: 1,
        wet: 1
      }),
      new TableEntry(34, 66, 'Ocean', '', {
        wet: 1
      }),
      new TableEntry(67, 100, 'Tropical Ocean', '', {
        hot: 1,
        wet: 1
      }),
    ])

    // Terrain Roughness
    new Table('TerrainRoughness', [
      new TableEntry(1, 50, 'Flat', '', {
        smooth: 1 // Converted from !rough
      }),
      new TableEntry(51, 85, 'Hilly', '', {
        rough: 1
      }),
      new TableEntry(86, 100, 'Mountainous', '', {
        rough: 3
      }),
    ])

    // Freshwater Source Router - This needs to be handled differently
    // We'll use the tag threshold logic in scenario events instead

    // Land Freshwater Sources (simplified subset for proof of concept)
    new Table('LandSources', [
      new TableEntry(1, 10, 'Mountain spring channeled via stone aqueduct', '', {
        canal: 1
      }), // rough > 2 requirement
      new TableEntry(11, 15, 'Mountainous snow melt routed through carved canals', '', {
        canal: 1
      }), // rough > 2 && cold
      new TableEntry(16, 20, 'Irrigation network of streams & canals', '', {
        canal: 1,
        stream: 1
      }), // wet requirement
      new TableEntry(21, 25, 'Underground river accessed through vertical shaft', '', {
        caves: 1,
        well: 1
      }),
      new TableEntry(26, 35, 'Extensive cistern network for rainfall', '', {
        cistern: 1
      }),
      new TableEntry(36, 40, 'Snowmelt collected in reservoir, stored year-round', '', {
        cistern: 1
      }), // cold requirement
      new TableEntry(41, 50, 'Lake directly adjacent to castle', '', {
        lake: 1
      }),
      new TableEntry(51, 60, 'Broad river flowing past castle walls', '', {
        river: 1
      }),
      new TableEntry(61, 70, 'Spring enclosed in dedicated spring house', '', {
        spring: 1
      }),
      new TableEntry(71, 80, 'Ancient integrated stepwell', '', {
        stepwell: 1
      }), // dry requirement
      new TableEntry(81, 90, 'Deep aquifers tapped by wells', '', {
        well: 1
      }),
      new TableEntry(91, 100, 'Well kept inside the castle walls', '', {
        well: 1
      })
    ])

    // Island Freshwater Sources
    new Table('IslandSources', [
      new TableEntry(1, 20, 'Freakishly large freshwater island lens provides enough freshwater to profitably ship to nearby islands', '', {
        aquifer: 1
      }),
      new TableEntry(21, 40, 'Huge rainwater cisterns collect a year\'s supply in advance', '', {
        cistern: 1
      }),
      new TableEntry(41, 50, 'Ancient desalination ritual makes ocean water drinkable'), // magic requirement
      new TableEntry(51, 60, 'Freshwater icebergs are mysteriously drinkable when melted; local iceberg gods worshiped'), // cold requirement
      new TableEntry(61, 75, 'Coastal aquifer tapped by deep reinforced wells that penetrate saltwater barriers', '', {
        aquifer: 1
      }),
      new TableEntry(76, 85, 'Coral atoll hosts sizable freshwater lens accessible via well', '', {
        coral: 1,
        well: 1
      }), // hot requirement
      new TableEntry(86, 95, 'Tiny island freshwater lens needs careful rationing', '', {
        thirsty: 1
      }),
      new TableEntry(96, 100, 'Regular boat shipments from nearby landmass with water', '', {
        thirsty: 1,
        trade: 1
      })
    ])

    // Regional Population
    new Table('RegionalPopulation', [
      new TableEntry(1, 5, 'Empty (0)', '', {
        poor: 1
      }),
      new TableEntry(6, 15, 'Wilderness (1-2)', '', {
        pop: 1,
        poor: 1
      }),
      new TableEntry(16, 25, 'Wild (3-9)', '', {
        pop: 2,
        poor: 1
      }),
      new TableEntry(26, 40, 'Frontier (10-29)', '', {
        pop: 3,
        poor: 1
      }),
      new TableEntry(41, 55, 'Settled (30-99)', '', {
        pop: 4
      }),
      new TableEntry(56, 75, 'Underdeveloped (100-299)', '', {
        pop: 5
      }), // mainland requirement
      new TableEntry(76, 90, 'Developed (300-999)', '', {
        pop: 6
      }), // rough < 3 && mainland requirements -> smooth && mainland  
      new TableEntry(91, 100, 'Core (1,000-3,000)', '', {
        pop: 7,
        rich: 1
      }) // !rough && !island requirements -> smooth && mainland
    ])
  }

  private initializeScenario() {
    // Start with Generator Tone
    this.scenario.add('GeneratorTone', Table.getKeys('GeneratorTone'), {
      LandOrSea: 1
    })
    
    // Land or Sea -> Biome Router
    this.scenario.add('LandOrSea', Table.getKeys('LandOrSea'), {
      BiomeRouter: 1
    })

    // Biome Router -> Actual Biome Tables
    this.scenario.add('BiomeRouter', 'Route to Land Biome', [
      new Outcome(1, 'LandBiome', {
        mainland: 1
      })
    ])
    
    this.scenario.add('BiomeRouter', 'Route to Ocean Biome', [
      new Outcome(1, 'OceanBiome', {
        island: 1
      })
    ])

    // Land Biomes -> Terrain Roughness
    Table.getKeys('LandBiome').forEach(biome => {
      this.scenario.add('LandBiome', biome, {
        TerrainRoughness: 1
      })
    })

    // Ocean Biomes -> Terrain Roughness
    Table.getKeys('OceanBiome').forEach(biome => {
      this.scenario.add('OceanBiome', biome, {
        TerrainRoughness: 1
      })
    })

    // Terrain Roughness -> Freshwater Sources (based on island/mainland tags)
    const terrainTypes = ['Flat', 'Hilly', 'Mountainous']
    terrainTypes.forEach(terrain => {
      this.scenario.add('TerrainRoughness', terrain, [
        // If island tag, go to island sources
        new Outcome(1, 'IslandSources', {
          island: 1
        }),
        // Otherwise (mainland), go to land sources  
        new Outcome(1, 'LandSources')
      ])
    })

    // Freshwater Sources -> Regional Population
    // Land sources
    Table.getKeys('LandSources').forEach(source => {
      this.scenario.add('LandSources', source, {
        RegionalPopulation: 1
      })
    })

    // Island sources
    Table.getKeys('IslandSources').forEach(source => {
      this.scenario.add('IslandSources', source, {
        RegionalPopulation: 1
      })
    })

    // Regional Population is terminal for this proof of concept
  }

  public async generate(): Promise<CastleGenerationResult> {
    const { path } = await this.scenario.run()
    
    // Extract results from path
    const generatorTone = path.find(p => p.tableName === 'GeneratorTone')?.entry || ''
    const landOrSea = path.find(p => p.tableName === 'LandOrSea')?.entry || ''
    const biome = path.find(p => p.tableName === 'LandBiome' || p.tableName === 'OceanBiome')?.entry || ''
    const terrainRoughness = path.find(p => p.tableName === 'TerrainRoughness')?.entry || ''
    const freshwaterSource = path.find(p => p.tableName === 'LandSources' || p.tableName === 'IslandSources')?.entry || ''
    const regionalPopulation = path.find(p => p.tableName === 'RegionalPopulation')?.entry || ''

    // Get final accumulated tags
    const finalTags = path[path.length - 1]?.tags || new Map()

    return {
      generatorTone,
      landOrSea,
      biome,
      terrainRoughness,
      freshwaterSource,
      regionalPopulation,
      tags: finalTags,
      seed: this.rng.seed || 'unknown',
      path: path.map(p => ({
        roll: p.roll,
        tableName: p.tableName,
        entry: p.entry,
        tags: new Map(p.tags)
      }))
    }
  }
}

test('creates an Outcome with default tagThresholds', async () => {
  const world = new MedievalCastleGenerator('beep1')
  const result = await world.generate()
  
  assert.equal(normalize(result), {
    generatorTone: 'Fantasy',
    landOrSea: 'Inland',
    biome: 'Prairie',
    terrainRoughness: 'Hilly',
    freshwaterSource: 'Broad river flowing past castle walls',
    regionalPopulation: 'Wild (3-9)',
    tags: [
      ['magic', 1],
      ['highmagic', 1],
      ['mainland', 1],
      ['dry', 1],
      ['rough', 1],
      ['river', 1],
      ['pop', 2],
      ['poor', 1]
    ],
    seed: 'beep1',
    path: [
      {
        roll: 37,
        tableName: 'GeneratorTone',
        entry: 'Fantasy',
        tags: [
          ['magic', 1],
          ['highmagic', 1]
        ]
      },
      { roll: 55, tableName: 'LandOrSea', entry: 'Inland', tags: [
        ['magic', 1],
        ['highmagic', 1],
        ['mainland', 1]
      ] },
      {
        roll: 24,
        tableName: 'BiomeRouter',
        entry: 'Route to Land Biome',
        tags: [
          ['magic', 1],
          ['highmagic', 1],
          ['mainland', 1]
        ]
      },
      { roll: 46, tableName: 'LandBiome', entry: 'Prairie', tags: [
        ['magic', 1],
        ['highmagic', 1],
        ['mainland', 1],
        ['dry', 1]
      ] },
      {
        roll: 83,
        tableName: 'TerrainRoughness',
        entry: 'Hilly',
        tags: [
          ['magic', 1],
          ['highmagic', 1],
          ['mainland', 1],
          ['dry', 1],
          ['rough', 1]
        ]
      },
      {
        roll: 59,
        tableName: 'LandSources',
        entry: 'Broad river flowing past castle walls',
        tags: [
          ['magic', 1],
          ['highmagic', 1],
          ['mainland', 1],
          ['dry', 1],
          ['rough', 1],
          ['river', 1]
        ]
      },
      {
        roll: 21,
        tableName: 'RegionalPopulation',
        entry: 'Wild (3-9)',
        tags: [
          ['magic', 1],
          ['highmagic', 1],
          ['mainland', 1],
          ['dry', 1],
          ['rough', 1],
          ['river', 1],
          ['pop', 2],
          ['poor', 1]
        ]
      }
    ]
  })
})

test.run()
