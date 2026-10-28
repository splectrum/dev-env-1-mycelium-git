#!/usr/bin/env node
// Command line for mycelium-uri, for test runs: one call per invocation.
//   node cli.js <op> <arg>...
// Prints one JSON line per audit event, then the outcome:
//   {"event": {...}} ... {"result": ...} or {"error": "..."} (exit 1)
// format takes the segments as arguments; split takes the branch names as
// a comma-separated list.

import { create } from './index.js'

const [op, ...args] = process.argv.slice(2)
const uri = create({ sink: event => console.log(JSON.stringify({ event })) })

if (!(op in uri)) {
  console.log(JSON.stringify({ error: `unknown op: ${op}` }))
  process.exit(2)
}
let callArgs = args
if (op === 'format') callArgs = [args]
if (op === 'split' && args[1] !== undefined) args[1] = args[1].split(',').filter(Boolean)

try {
  console.log(JSON.stringify({ result: uri[op](...callArgs) }))
} catch (err) {
  console.log(JSON.stringify({ error: err.message }))
  process.exit(1)
}
