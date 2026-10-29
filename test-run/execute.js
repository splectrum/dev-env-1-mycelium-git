#!/usr/bin/env node
// Execute: kicks the repository into action. For each request on
// pending/default that has no response on main yet, it executes the request
// from the deployed capability branch and responds on execute/main, merged
// into main with a plain merge. It records what happened; it does not judge.
//   node execute.js <repo> [capability-branch]   (default: capability/test)
//
// A request is pending/<name>/request.md, with one of:
//   Run: <tests-file> in <folder>   run a list of invocations (runner.js)
//   Report: runs                    interpret the record (report.js)
// A tests file under pending/ is read from the request on pending/default,
// any other path from the capability tree. Run requests execute first, in
// name order, then Report requests, so a report sees the completed runs.
//
// The response is main:responses/<name>/:
//   response.md   what was executed, on which states, and the outcome
//   unit.json     the unit's record: invocation, states by commit,
//                 environment and nondeterministic inputs; enough to rerun
//   results.jsonl (Run) one line per invocation: command, exit, output
//   report.md     (Report) the report
// pending/default is not written: it holds the requests only.
//
// Reads and writes go through mycelium-git, deployed next to this file; the
// code that runs is the deployed tree this file is part of.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { nativeBackend, openRepo, pinned, writer } from './mycelium-git/index.js'

const code = dirname(fileURLToPath(import.meta.url))

const [repo, capability = 'capability/test'] = process.argv.slice(2)
if (!repo) {
  console.error('usage: execute.js <repo> [capability-branch]')
  process.exit(2)
}

const backend = nativeBackend(repo)
const now = openRepo(backend)
const w = writer(backend)
const author = { name: 'test-run', email: 'test-run@localhost' }
const found = async path => (await now.select(path)).length > 0
const name = path => path.split('/').pop()

const pending = []
for (const [path] of await now.select('/pending/default/pending/*')) {
  if (!await found(`${path}/request.md`) || await found(`/main/responses/${name(path)}`)) continue
  const text = (await now.read(`${path}/request.md`)).toString()
  const run = text.match(/^Run:\s*(\S+)\s+in\s+(\S+)\s*$/m)
  const report = text.match(/^Report:\s*(\S+)\s*$/m)
  pending.push({ name: name(path), run, report, line: (run || report || [null])[0] })
}
pending.sort((a, b) => (!!a.report - !!b.report) || a.name.localeCompare(b.name))

for (const request of pending) await execute(request)
console.log(JSON.stringify({ executed: pending.map(r => r.name) }))

async function execute ({ name, run: runLine, report: reportLine, line }) {
  const runId = new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()
  const started = new Date().toISOString()
  // Every state the unit runs on, by commit, before anything changes.
  const branches = Object.fromEntries(await backend.listBranches())
  const state = Object.fromEntries(['pending/default', 'main', 'execute/main', capability]
    .map(b => [b, branches[b]]))
  const work = mkdtempSync(join(tmpdir(), 'execute-'))
  const unit = {
    invocation: { request: name, line },
    state,
    environment: {
      node: process.version,
      git: spawnSync('git', ['--version'], { encoding: 'utf8' }).stdout.trim(),
      platform: `${process.platform}-${process.arch}`
    },
    nondeterministic: { run: runId, started, workDir: work }
  }

  try {
    const out = join(work, 'response')
    mkdirSync(out)

    let outcome
    if (!line) {
      outcome = "not executed: the request has no 'Run:' or 'Report:' line."
    } else if (runLine) {
      outcome = await runTests(state, work, out, runLine[1], runLine[2])
    } else {
      outcome = makeReport(out, reportLine[1])
    }

    unit.nondeterministic.finished = new Date().toISOString()
    writeFileSync(join(out, 'unit.json'), JSON.stringify(unit, null, 2) + '\n')
    const report = existsSync(join(out, 'report.md')) ? '\n' + readFileSync(join(out, 'report.md'), 'utf8') : ''
    writeFileSync(join(out, 'response.md'),
      `# Response: ${name}\n\n${outcome}\n\n` +
      `Executed \`${line || '(none)'}\` from \`${capability}\` at \`${state[capability].slice(0, 7)}\`, ` +
      `on \`pending/default\` at \`${state['pending/default'].slice(0, 7)}\` and \`main\` at \`${state.main.slice(0, 7)}\`. ` +
      'The unit record is `unit.json`.\n' + report)

    // Respond on execute/main, synced with main first, then a plain merge
    // into main. The request is referenced by the pending/default commit.
    const request = `Request: ${state['pending/default'].slice(0, 7)}:pending/${name}/request.md`
    await w.merge('main', 'execute/main', 'Merge main into execute/main', { author, fastForward: true })
    const c = await w.change('execute/main')
    for (const file of readdirSync(out)) await c.put(`/responses/${name}/${file}`, readFileSync(join(out, file)))
    await c.commit(`Respond to ${name}\n\n${outcome}\n\n${request}\n`, { author })
    await w.merge('execute/main', 'main', `Merge execute/main: response to ${name}\n\n${request}\n`, { author })
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
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

// Interpret the record with the deployed report.js; the report is report.md.
function makeReport (out, scope) {
  const r = spawnSync('node', [join(code, 'report.js'), repo, scope], { encoding: 'utf8' })
  if (r.status !== 0) {
    writeFileSync(join(out, 'error.txt'), r.stderr)
    return `The report could not be made (exit ${r.status}); its error output is \`error.txt\`.`
  }
  writeFileSync(join(out, 'report.md'), r.stdout)
  return 'Report made: `report.md`.'
}
