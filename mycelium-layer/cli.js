#!/usr/bin/env node
// Command line for mycelium-layer, the test entry point.
//   node cli.js [--engine=E] [--from-engine=E] import <repo> <from-repo> <branch> [as]
//   node cli.js [--engine=E] deploy <repo> <layer> <folder>
//   node cli.js [--engine=E] extract <repo> <layer> <path> <folder>
//   node cli.js [--engine=E] intake <repo> <folder> <name>
//   node cli.js [--engine=E] export <repo> <layer> <file>
//   node cli.js [--engine=E] import-bundle <repo> <file> [branch] [as]
// Engines: native (default), isogit, p2pgit; --engine is the receiving
// repository's, --from-engine the other's (default the same).
// deploy and intake commit as 'cli' at a fixed time, so their oids are stable.
// Prints the outcome as one JSON line: {"result": ...}, or {"error": "..."}
// with exit 1. Branch names come in from outside: validated here.

import process from 'node:process'
import { validate } from '../mycelium-uri/index.js'
import { nativeBackend, isogitBackend, p2pgitBackend } from '../mycelium-git/index.js'
import { importLayer, exportLayer, importBundle, deploy, extract, intake } from './index.js'

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
const [op, dir, ...args] = argv

try {
  for (const e of [engine, fromEngine]) if (!(e in engines)) throw new Error(`unknown engine: ${e}`)
  let result
  if (op === 'import') {
    const [fromDir, from, as] = args
    result = await importLayer({
      from: engines[fromEngine](fromDir),
      to: engines[engine](dir),
      branch: branch(from),
      as: as === undefined ? undefined : branch(as)
    })
  } else if (op === 'deploy') {
    const [layer, folder] = args
    result = await deploy({
      backend: engines[engine](dir),
      layer: branch(layer),
      folder,
      message: `Deploy ${folder}`,
      author: { name: 'cli', email: 'cli@localhost' },
      time: '2026-01-02T00:00:00Z'
    })
  } else if (op === 'extract') {
    const [layer, path, folder] = args
    result = await extract({ backend: engines[engine](dir), layer: branch(layer), path: validate(path), folder })
  } else if (op === 'intake') {
    const [folder, name] = args
    const segment = validate('/' + name).slice(1)
    if (segment.includes('/') || !segment) throw new Error(`not a request name: ${name}`)
    result = await intake({
      backend: engines[engine](dir),
      folder,
      name: segment,
      author: { name: 'cli', email: 'cli@localhost' },
      time: '2026-01-02T00:00:00Z'
    })
  } else if (op === 'export') {
    const [layer, file] = args
    result = await exportLayer({ backend: engines[engine](dir), layer: branch(layer), file })
  } else if (op === 'import-bundle') {
    const [file, from, as] = args
    result = await importBundle({
      backend: engines[engine](dir),
      file,
      branch: from === undefined ? undefined : branch(from),
      as: as === undefined ? undefined : branch(as)
    })
  } else {
    throw new Error(`unknown op: ${op}`)
  }
  console.log(JSON.stringify({ result }))
} catch (err) {
  console.log(JSON.stringify({ error: err.message }))
  process.exit(1)
}
