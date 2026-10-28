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

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const [repo, capability = 'capability/test'] = process.argv.slice(2)
if (!repo) {
  console.error('usage: execute.js <repo> [capability-branch]')
  process.exit(2)
}

const git = (args, opts = {}) => {
  const r = spawnSync('git', args, { cwd: opts.cwd || repo, encoding: 'utf8', maxBuffer: 1 << 30 })
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`git ${args.join(' ')}: ${r.stderr.trim()}`)
  }
  return r.status === 0 ? r.stdout.trim() : null
}
const exists = spec => git(['cat-file', '-e', spec], { allowFail: true }) !== null

git(['worktree', 'prune'])
const pending = git(['ls-tree', '-d', '--name-only', 'pending/default:pending']).split('\n').filter(Boolean)
  .filter(name => exists(`pending/default:pending/${name}/request.md`) && !exists(`main:responses/${name}`))
  .map(name => {
    const text = git(['show', `pending/default:pending/${name}/request.md`])
    const run = text.match(/^Run:\s*(\S+)\s+in\s+(\S+)\s*$/m)
    const report = text.match(/^Report:\s*(\S+)\s*$/m)
    return { name, run, report, line: (run || report || [null])[0] }
  })
  .sort((a, b) => (!!a.report - !!b.report) || a.name.localeCompare(b.name))

for (const request of pending) execute(request)
console.log(JSON.stringify({ executed: pending.map(r => r.name) }))

function execute ({ name, run: runLine, report: reportLine, line }) {
  const runId = new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()
  const started = new Date().toISOString()
  // Every state the unit runs on, by commit, before anything changes.
  const state = Object.fromEntries(['pending/default', 'main', 'execute/main', capability]
    .map(b => [b, git(['rev-parse', b])]))
  const work = mkdtempSync(join(tmpdir(), 'execute-'))
  const unit = {
    invocation: { request: name, line },
    state,
    environment: { node: process.version, git: git(['--version']), platform: `${process.platform}-${process.arch}` },
    nondeterministic: { run: runId, started, workDir: work }
  }

  try {
    // The deployed capability tree is what runs.
    const code = join(work, 'code')
    mkdirSync(code)
    const archive = spawnSync('git', ['archive', state[capability]], { cwd: repo, maxBuffer: 1 << 30 })
    spawnSync('tar', ['-x', '-C', code], { input: archive.stdout })

    const execWt = join(work, 'execute')
    git(['worktree', 'add', '-q', execWt, 'execute/main'])
    git(['merge', '-q', '--no-edit', 'main'], { cwd: execWt })
    const out = join(execWt, 'responses', name)
    mkdirSync(out, { recursive: true })

    let outcome
    if (!line) {
      outcome = "not executed: the request has no 'Run:' or 'Report:' line."
    } else if (runLine) {
      outcome = runTests(code, work, out, runLine[1], runLine[2])
    } else {
      outcome = makeReport(code, out, reportLine[1])
    }

    unit.nondeterministic.finished = new Date().toISOString()
    writeFileSync(join(out, 'unit.json'), JSON.stringify(unit, null, 2) + '\n')
    const report = existsSync(join(out, 'report.md')) ? '\n' + readFileSync(join(out, 'report.md'), 'utf8') : ''
    writeFileSync(join(out, 'response.md'),
      `# Response: ${name}\n\n${outcome}\n\n` +
      `Executed \`${line || '(none)'}\` from \`${capability}\` at \`${state[capability].slice(0, 7)}\`, ` +
      `on \`pending/default\` at \`${state['pending/default'].slice(0, 7)}\` and \`main\` at \`${state.main.slice(0, 7)}\`. ` +
      'The unit record is `unit.json`.\n' + report)
    git(['add', '.'], { cwd: execWt })
    git(['commit', '-q', '-m', `Respond to ${name}\n\n${outcome}\n\n` +
      `Request: ${state['pending/default'].slice(0, 7)}:pending/${name}/request.md`], { cwd: execWt })
    git(['worktree', 'remove', execWt])

    mergeIntoMain(`Merge execute/main: response to ${name}\n\n` +
      `Request: ${state['pending/default'].slice(0, 7)}:pending/${name}/request.md`)
  } finally {
    // Remove the folder first, so prune drops worktrees a failure left behind.
    rmSync(work, { recursive: true, force: true })
    git(['worktree', 'prune'])
  }
}

// Run a list of invocations through the deployed runner; the record is
// results.jsonl. The outcome says whether the runner completed, nothing more.
function runTests (code, work, out, testsPath, folder) {
  let testsFile = join(code, testsPath)
  if (testsPath.startsWith('pending/')) {
    // A missing file stays missing, so the runner reports the error.
    testsFile = join(work, 'tests.txt')
    const tests = git(['show', `pending/default:${testsPath}`], { allowFail: true })
    if (tests !== null) writeFileSync(testsFile, tests + '\n')
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
function makeReport (code, out, scope) {
  const r = spawnSync('node', [join(code, 'report.js'), repo, scope], { encoding: 'utf8' })
  if (r.status !== 0) {
    writeFileSync(join(out, 'error.txt'), r.stderr)
    return `The report could not be made (exit ${r.status}); its error output is \`error.txt\`.`
  }
  writeFileSync(join(out, 'report.md'), r.stdout)
  return 'Report made: `report.md`.'
}

// Plain merge into main, from main's own worktree if it is checked out.
function mergeIntoMain (message) {
  if (git(['symbolic-ref', '--short', '-q', 'HEAD'], { allowFail: true }) === 'main') {
    git(['merge', '-q', '--no-ff', '-m', message, 'execute/main'])
    return
  }
  const wt = mkdtempSync(join(tmpdir(), 'main-'))
  rmSync(wt, { recursive: true })
  git(['worktree', 'add', '-q', wt, 'main'])
  try {
    git(['merge', '-q', '--no-ff', '-m', message, 'execute/main'], { cwd: wt })
  } finally {
    git(['worktree', 'remove', '--force', wt])
  }
}
