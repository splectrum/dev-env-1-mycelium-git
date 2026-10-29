#!/usr/bin/env node
// Command line for mycelium-git, the test entry point.
//   node cli.js select <repo> <path>   [path, node] pairs
//   node cli.js read <repo> <path>     the file's content, as text
// The path comes in from outside, so it is validated here, at the boundary;
// select accepts '*' steps.
// Prints the outcome as one JSON line: {"result": ...}, or {"error": "..."}
// with exit 1.

import { validate } from '../mycelium-uri/index.js'
import { nativeBackend, openRepo } from './index.js'

const [op, dir, path] = process.argv.slice(2)

try {
  if (op !== 'select' && op !== 'read') throw new Error(`unknown op: ${op}`)
  const repo = openRepo(nativeBackend(dir))
  const result = op === 'select' ? await repo.select(validate(path, { star: true }))
    : (await repo.read(validate(path))).toString()
  console.log(JSON.stringify({ result }))
} catch (err) {
  console.log(JSON.stringify({ error: err.message }))
  process.exit(1)
}
