#!/usr/bin/env node
// Command line for mycelium-uri, the test entry point: one call per invocation.
//   node cli.js <op> <arg>...
// Prints the outcome as one JSON line: {"result": ...}, or {"error": "..."}
// with exit 1. format takes the segments as arguments; split takes the
// branch names as a comma-separated list.

import * as uri from './index.js'

const [op, ...args] = process.argv.slice(2)

if (!(op in uri)) {
  console.log(JSON.stringify({ error: `unknown op: ${op}` }))
  process.exit(2)
}
let callArgs = args
if (op === 'format') callArgs = [args]
if (op === 'split' && args[1] !== undefined) callArgs = [args[0], args[1].split(',').filter(Boolean)]

try {
  console.log(JSON.stringify({ result: uri[op](...callArgs) }))
} catch (err) {
  console.log(JSON.stringify({ error: err.message }))
  process.exit(1)
}
