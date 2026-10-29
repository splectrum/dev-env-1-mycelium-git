#!/usr/bin/env node
// Command line for mycelium-repo, the test entry point.
//   node cli.js [--engine=E] [--product-engine=E] publish <repo> <package> <product>
//   node cli.js [--engine=E] receive <product>
// Engines: native (default), isogit, p2pgit; --product-engine is the
// product repository's (default the same). receive commits as 'cli' at a
// fixed time, so its oids are stable.
// Prints the outcome as one JSON line: {"result": ...}, or {"error": "..."}
// with exit 1. Names come in from outside: validated here.

import process from 'node:process'
import { validate } from '../mycelium-uri/index.js'
import { nativeBackend, isogitBackend, p2pgitBackend } from '../mycelium-git/index.js'
import { publish, receive } from './index.js'

const engines = { native: nativeBackend, isogit: isogitBackend, p2pgit: p2pgitBackend }
const argv = process.argv.slice(2)
const flags = {}
while (argv[0] && argv[0].startsWith('--')) {
  const [k, v] = argv.shift().slice(2).split('=')
  flags[k] = v
}
const engine = flags.engine || 'native'
const productEngine = flags['product-engine'] || engine
const segment = name => {
  const s = validate('/' + name).slice(1)
  if (s.includes('/') || s === '') throw new Error(`not a package: ${name}`)
  return s
}
const [op, ...args] = argv

try {
  for (const e of [engine, productEngine]) if (!(e in engines)) throw new Error(`unknown engine: ${e}`)
  let result
  if (op === 'publish') {
    const [dir, pkg, productDir] = args
    result = await publish({ repo: engines[engine](dir), pkg: segment(pkg), product: engines[productEngine](productDir) })
  } else if (op === 'receive') {
    result = await receive({
      product: engines[engine](args[0]),
      message: 'Merge execute/main: published',
      author: { name: 'cli', email: 'cli@localhost' },
      time: '2026-01-02T00:00:00Z'
    })
  } else {
    throw new Error(`unknown op: ${op}`)
  }
  console.log(JSON.stringify({ result }))
} catch (err) {
  console.log(JSON.stringify({ error: err.message }))
  process.exit(1)
}
