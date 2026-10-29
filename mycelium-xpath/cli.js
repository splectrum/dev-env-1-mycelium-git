#!/usr/bin/env node
// Command line for mycelium-xpath, the test entry point.
//   node cli.js <resolve|select> <tree.json> <path>
// The tree is a JSON file of plain objects (folders) and values (leaves).
// Prints the outcome as one JSON line: {"result": ...}, or {"error": "..."}
// with exit 1. select prints [path, node] pairs.

import { readFileSync } from 'node:fs'
import { resolve, select, objectChildren } from './index.js'

const ops = { resolve, select }
const [op, file, path] = process.argv.slice(2)

try {
  if (!(op in ops)) throw new Error(`unknown op: ${op}`)
  const tree = JSON.parse(readFileSync(file, 'utf8'))
  const result = await ops[op](objectChildren, tree, path)
  console.log(JSON.stringify({ result: result === undefined ? null : result }))
} catch (err) {
  console.log(JSON.stringify({ error: err.message }))
  process.exit(1)
}
