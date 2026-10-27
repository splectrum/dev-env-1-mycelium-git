#!/usr/bin/env node
// Simple test runner: reads tests from a file, line by line, runs each and
// writes one JSON line per test to the output file.
//   node runner.js <tests-file> <cwd> <output-file>
// A test line is '<expect> <command> <arg>...'; <expect> is ok (exit 0) or
// error (non-zero exit). Blank lines and '#' lines are skipped. Commands are
// split on whitespace and run without a shell, so arguments are literal.
// Exits 1 if any test fails.

import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const [testsFile, cwd, outputFile] = process.argv.slice(2)
if (!outputFile) {
  console.error('usage: runner.js <tests-file> <cwd> <output-file>')
  process.exit(2)
}

const lines = readFileSync(testsFile, 'utf8').split('\n')
const out = []
let passed = 0
let failed = 0

lines.forEach((text, i) => {
  const line = text.trim()
  if (line === '' || line.startsWith('#')) return
  const [expect, command, ...args] = line.split(/\s+/)
  const start = performance.now()
  const run = spawnSync(command, args, { cwd, encoding: 'utf8' })
  const ms = performance.now() - start
  const got = run.status === 0 ? 'ok' : 'error'
  const pass = got === expect
  if (pass) passed++; else failed++
  out.push(JSON.stringify({
    line: i + 1, expect, command: [command, ...args], code: run.status,
    got, pass, ms, stdout: parseLines(run.stdout), stderr: run.stderr || undefined
  }))
})

writeFileSync(outputFile, out.join('\n') + '\n')
console.log(JSON.stringify({ tests: passed + failed, passed, failed }))
process.exit(failed === 0 ? 0 : 1)

// Keep JSON output as data, anything else as text.
function parseLines (text) {
  return (text || '').split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l) } catch { return l }
  })
}
