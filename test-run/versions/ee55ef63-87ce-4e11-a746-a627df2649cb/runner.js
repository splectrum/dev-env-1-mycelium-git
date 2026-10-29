#!/usr/bin/env node
// Runner: executes a list of invocations, line by line, and records what
// happened. It does not judge; interpreting the record is a report's job.
//   node runner.js <tests-file> <cwd> <output-file>
// A line is '<command> <arg>... [=> <expectation>]'. The expectation is part
// of the request, for the report; the runner executes only the command,
// split on whitespace and run without a shell, so arguments are literal.
// Blank lines and '#' lines are skipped. One JSON line per invocation.

import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const [testsFile, cwd, outputFile] = process.argv.slice(2)
if (!outputFile) {
  console.error('usage: runner.js <tests-file> <cwd> <output-file>')
  process.exit(2)
}

const out = []
readFileSync(testsFile, 'utf8').split('\n').forEach((text, i) => {
  const line = text.trim()
  if (line === '' || line.startsWith('#')) return
  const [command, ...args] = line.split('=>')[0].trim().split(/\s+/)
  const run = spawnSync(command, args, { cwd, encoding: 'utf8' })
  out.push(JSON.stringify({
    line: i + 1, command: [command, ...args], code: run.status,
    stdout: run.stdout, stderr: run.stderr, error: run.error?.message
  }))
})

writeFileSync(outputFile, out.length ? out.join('\n') + '\n' : '')
console.log(JSON.stringify({ invocations: out.length }))
