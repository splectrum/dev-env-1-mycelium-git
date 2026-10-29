#!/usr/bin/env node
// Execute: kicks the repository into action. The request flow is
// layer/request's (executeRequests, mycelium-layer, deployed next to this
// file): each pending request executed on a fixed state, answered on
// execute/main, merged into main, with its unit recorded. What's specific to
// test runs is here: the kinds of request, their order, and how each is
// executed. It records what happened; it does not judge.
//   node execute.js <repo> [capability-branch]   (default: capability/test)
//
// A request is pending/<name>/request.md, with one of:
//   Run: <tests-file> in <folder>   run a list of invocations (runner.js)
//   Report: runs                    interpret the record (report.js)
// A tests file under pending/ is read from the request at the unit's state,
// any other path from the capability tree. Run requests execute first, in
// name order, then Report requests, so a report sees the completed runs.
//
// Beside unit.json and response.md, the response holds results.jsonl (Run),
// report.md (Report), or error.txt when the runner or the report failed.

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { nativeBackend, openRepo, pinned } from './mycelium-git/index.js'
import { executeRequests } from './mycelium-layer/index.js'

const code = dirname(fileURLToPath(import.meta.url))

const [repo, capability = 'capability/test'] = process.argv.slice(2)
if (!repo) {
  console.error('usage: execute.js <repo> [capability-branch]')
  process.exit(2)
}
const backend = nativeBackend(repo)

const executed = await executeRequests({
  backend,
  capability,
  author: { name: 'test-run', email: 'test-run@localhost' },
  environment: {
    node: process.version,
    git: spawnSync('git', ['--version'], { encoding: 'utf8' }).stdout.trim(),
    bare: spawnSync('bare', ['--version'], { encoding: 'utf8' }).stdout?.trim() || null,
    platform: `${process.platform}-${process.arch}`
  },
  plan,
  handle
})
console.log(JSON.stringify({ executed }))

// The kinds of request, and their order: runs first, then reports.
function plan (pending) {
  return pending.map(({ name, text }) => {
    const run = text.match(/^Run:\s*(\S+)\s+in\s+(\S+)\s*$/m)
    const report = text.match(/^Report:\s*(\S+)\s*$/m)
    return { name, run, report, line: (run || report || [null])[0] }
  }).sort((a, b) => (!!a.report - !!b.report) || a.name.localeCompare(b.name))
}

async function handle (request, { state, work, out }) {
  if (!request.line) return { outcome: "not executed: the request has no 'Run:' or 'Report:' line." }
  if (request.run) return { outcome: await runTests(state, work, out, request.run[1], request.run[2]) }
  return makeReport(out, request.report[1])
}

// Run a list of invocations through the deployed runner; the record is
// results.jsonl. The outcome says whether the runner completed, nothing more.
async function runTests (state, work, out, testsPath, folder) {
  let testsFile = join(code, testsPath)
  if (testsPath.startsWith('pending/')) {
    // From the request, at the unit's state. A missing file stays missing,
    // so the runner reports the error.
    testsFile = join(work, 'tests.txt')
    const at = openRepo(pinned(backend, state))
    const path = `/pending/default/${testsPath}`
    if ((await at.select(path)).length) writeFileSync(testsFile, await at.read(path))
  }
  const r = spawnSync('node', [join(code, 'runner.js'), testsFile, join(code, folder),
    join(out, 'results.jsonl')], { encoding: 'utf8' })
  if (r.status !== 0) {
    writeFileSync(join(out, 'error.txt'), r.stderr)
    return `The runner did not complete (exit ${r.status}); its error output is \`error.txt\`.`
  }
  const { invocations } = JSON.parse(r.stdout.trim().split('\n').pop())
  return `Executed ${invocations} invocations; the record is \`results.jsonl\`.`
}

// Interpret the record with the deployed report.js; the report is report.md,
// and also the body of the response.
function makeReport (out, scope) {
  const r = spawnSync('node', [join(code, 'report.js'), repo, scope], { encoding: 'utf8' })
  if (r.status !== 0) {
    writeFileSync(join(out, 'error.txt'), r.stderr)
    return { outcome: `The report could not be made (exit ${r.status}); its error output is \`error.txt\`.` }
  }
  writeFileSync(join(out, 'report.md'), r.stdout)
  return { outcome: 'Report made: `report.md`.', body: r.stdout }
}
