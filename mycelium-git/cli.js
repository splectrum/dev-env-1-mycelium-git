#!/usr/bin/env node
// Command line for mycelium-git, the test entry point.
//   node cli.js select <repo> <path>                [path, node] pairs
//   node cli.js read <repo> <path>                  the file's content, as text
//   node cli.js put <repo> <branch> <path> <text>   one put, committed
//   node cli.js remove <repo> <branch> <path>       one remove, committed
//   node cli.js merge <repo> <from> <into>          a plain merge
// Prints the outcome as one JSON line: {"result": ...}, or {"error": "..."}
// with exit 1. Commits are by 'cli' at a fixed time, so oids are stable.
//
// Arguments come in from outside, so this is the boundary. A path to read
// or select is validated, then selected with sameName to find the stored
// names. A path to write is validated and written in its canonical,
// lowercase form: inside our repositories every name is lowercase. A branch
// name is validated as a URI.

import { validate, sameName } from '../mycelium-uri/index.js'
import { nativeBackend, openRepo, writer } from './index.js'

const [op, dir, ...args] = process.argv.slice(2)
const commit = { author: { name: 'cli', email: 'cli@localhost' }, time: '2026-01-02T00:00:00Z' }
const branch = name => validate('/' + name).slice(1)
const writePath = path => validate(path)

const ops = {
  select: async (repo, path) => repo.select(validate(path, { star: true }), sameName),
  read: async (repo, path) => (await repo.read(validate(path), sameName)).toString(),
  put: async (repo, w, b, path, text) => {
    const c = await w.change(branch(b))
    await c.put(writePath(path), text)
    return c.commit(`Put ${path}`, commit)
  },
  remove: async (repo, w, b, path) => {
    const c = await w.change(branch(b))
    c.remove(writePath(path))
    return c.commit(`Remove ${path}`, commit)
  },
  merge: async (repo, w, from, into) =>
    w.merge(branch(from), branch(into), `Merge ${from} into ${into}`, commit)
}

try {
  if (!(op in ops)) throw new Error(`unknown op: ${op}`)
  const backend = nativeBackend(dir)
  const repo = openRepo(backend)
  const result = op === 'select' || op === 'read'
    ? await ops[op](repo, ...args)
    : await ops[op](repo, writer(backend), ...args)
  console.log(JSON.stringify({ result }))
} catch (err) {
  console.log(JSON.stringify({ error: err.message }))
  process.exit(1)
}
