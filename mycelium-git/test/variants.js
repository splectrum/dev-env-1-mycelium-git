// Generate the engine and runtime variants of the test commands from
// commands.txt (native git on Node): the same invocations and expectations,
// run with another engine or on Bare.
//   node test/variants.js
import { readFileSync, writeFileSync } from 'node:fs'

const here = new URL('.', import.meta.url)
const base = readFileSync(new URL('commands.txt', here), 'utf8')
// The base's own three-line header is replaced by each variant's.
const body = base.split('\n').slice(3)
const variants = {
  isogit: ['isomorphic-git', 'node cli.js --engine=isogit '],
  p2pgit: ['p2p-git', 'node cli.js --engine=p2pgit '],
  'bare-native': ['native git on Bare', 'bare cli.js --engine=native '],
  'bare-isogit': ['isomorphic-git on Bare', 'bare cli.js --engine=isogit '],
  'bare-p2pgit': ['p2p-git on Bare', 'bare cli.js --engine=p2pgit ']
}
for (const [name, [what, prefix]] of Object.entries(variants)) {
  const head = `# Test commands for mycelium-git on ${what}: generated from commands.txt\n` +
    '# by test/variants.js, with the same expectations.\n'
  writeFileSync(new URL(`commands-${name}.txt`, here), head + body.join('\n').replaceAll('node cli.js ', prefix))
}
