#!/usr/bin/env node
// Command line for mycelium-layer, the test entry point.
//   node cli.js [--engine=E] [--from-engine=E] import <repo> <from-repo> <branch> [as]
// Engines: native (default), isogit, p2pgit; --engine is the receiving
// repository's, --from-engine the other's (default the same).
// Prints the outcome as one JSON line: {"result": ...}, or {"error": "..."}
// with exit 1. Branch names come in from outside: validated here.

import process from 'node:process'
import { validate } from '../mycelium-uri/index.js'
import { nativeBackend, isogitBackend, p2pgitBackend } from '../mycelium-git/index.js'
import { importLayer } from './index.js'

const engines = { native: nativeBackend, isogit: isogitBackend, p2pgit: p2pgitBackend }
const argv = process.argv.slice(2)
const flags = {}
while (argv[0] && argv[0].startsWith('--')) {
  const [k, v] = argv.shift().slice(2).split('=')
  flags[k] = v
}
const engine = flags.engine || 'native'
const fromEngine = flags['from-engine'] || engine
const branch = name => validate('/' + name).slice(1)
const [op, dir, fromDir, from, as] = argv

try {
  for (const e of [engine, fromEngine]) if (!(e in engines)) throw new Error(`unknown engine: ${e}`)
  if (op !== 'import') throw new Error(`unknown op: ${op}`)
  const result = await importLayer({
    from: engines[fromEngine](fromDir),
    to: engines[engine](dir),
    branch: branch(from),
    as: as === undefined ? undefined : branch(as)
  })
  console.log(JSON.stringify({ result }))
} catch (err) {
  console.log(JSON.stringify({ error: err.message }))
  process.exit(1)
}
