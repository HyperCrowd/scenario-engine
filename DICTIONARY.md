# Continent: Continent Type
|Roll|Outcome|Tags|Requires|Description|
|---|---|---|---|---|
|1|Jungle|damp:1,hot:1||You enter a jungle|
|2|Tundra|damp:1,cold:1||You enter a tundra|
|3-10|Plains|||You enter the plains|
|11-15|Forest|||You enter a forest|
|16|Desert|arid:1,hot:1||You enter a desert|
|17|Arctic|arid:1,cold:1||You enter the arctic|

# Home: Home Type
|Roll|Outcome|Tags|Requires|Description|
|---|---|---|---|---|
|1|None|||None|
|2-10|Simple|||Simple|
|11-15|Modest|||Modest|
|16|Large|||Large|
|17|Opulent|||Opulent|

# Weather: Normal Weather
|Roll|Outcome|Tags|Requires|
|---|---|---|---|
|1|Wet, Cold||damp:1,cold:1|
|2|Dry, Cold||arid:1,cold:1|
|3-10|Wet, Warm||damp:1|
|10-15|Average Moisture, Average Temperature||damp:1|
|16-17|Dry, Warm||arid:1|
|18|Dry, Hot||arid:1,hot:1|
|19|Dry, Cold||arid:1,cold:1|

## Scenario: Generate World
|From|Entry|Go To|Likelihood|Requires|
|---|---|---|---|
|Continent|*|Home|1||
|Home|*|Weather|1||
