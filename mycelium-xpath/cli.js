#!/usr/bin/env node
// Command line for mycelium-xpath, the test entry point.
//   node cli.js select <tree.json> <path>
// The tree is a JSON file of plain objects (folders) and values (leaves).
// Prints the outcome as one JSON line: {"result": ...}, or {"error": "..."}
// with exit 1. The result is a list of [path, node] pairs. The path comes in
// from outside, so it is validated here, at the boundary.

import { readFileSync } from 'node:fs'
import { validate } from '../mycelium-uri/index.js'
import { select, objectChildren } from './index.js'

const ops = { select }
const [op, file, path] = process.argv.slice(2)

try {
  if (!(op in ops)) throw new Error(`unknown op: ${op}`)
  const tree = JSON.parse(readFileSync(file, 'utf8'))
  const result = await ops[op](objectChildren, tree, validate(path, { star: true }))
  console.log(JSON.stringify({ result }))
} catch (err) {
  console.log(JSON.stringify({ error: err.message }))
  process.exit(1)
}
