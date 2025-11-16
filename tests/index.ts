import { glob } from 'glob'

const cwd = process.cwd()

async function test() {
  const files = await glob('tests/**/*.test.ts', {
  ignore: ['**/node_modules/**', '**/*.d.ts']
})

  for (const file of files) {  
    await import(cwd + '/' + file)
  }
}

test()
