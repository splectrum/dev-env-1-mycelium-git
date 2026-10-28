#!/usr/bin/env node
// Execution hook: checks pending/default for requests not yet answered and
// executes them from the deployed capability branch.
//   node execute.js <repo> [capability-branch]   (default: capability/test)
//
// A request is pending/<name>/request.md. Its 'Run:' line names a tests file
// and the folder to run it from, both in the capability tree:
//   Run: mycelium-uri/test/commands.txt in mycelium-uri
// A tests file under pending/ is read from pending/default instead, so a
// request can bring its own tests:
//   Run: pending/<name>/tests.txt in mycelium-uri
// A 'Report:' line asks for a report on the repository's own requests and
// runs, made by the deployed report.js; the report is the response:
//   Report: runs
// A request is answered when main holds responses/<name>.md.
//
// For each pending request:
// 1. The capability tree is extracted into a temporary folder (the deployed
//    code is what runs, not main).
// 2. The runner writes its output, which is committed to pending/default
//    under pending/<name>/runs/<run>/ (execution data belongs to the request).
// 3. The response is committed to execute/main, after merging main into it,
//    and merged into main with a plain merge, referencing the pending commit.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const [repo, capability = 'capability/test'] = process.argv.slice(2)
if (!repo) {
  console.error('usage: execute.js <repo> [capability-branch]')
  process.exit(2)
}

const git = (args, opts = {}) => {
  const r = spawnSync('git', args, { cwd: opts.cwd || repo, encoding: 'utf8', input: opts.input })
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`git ${args.join(' ')}: ${r.stderr.trim()}`)
  }
  return r.status === 0 ? r.stdout.trim() : null
}

git(['worktree', 'prune'])
const requests = git(['ls-tree', '-d', '--name-only', 'pending/default:pending']).split('\n').filter(Boolean)
const pending = requests.filter(name =>
  git(['cat-file', '-e', `pending/default:pending/${name}/request.md`], { allowFail: true }) !== null &&
  git(['cat-file', '-e', `main:responses/${name}.md`], { allowFail: true }) === null)

if (pending.length === 0) {
  console.log(JSON.stringify({ pending: 0 }))
  process.exit(0)
}

let anyFailed = false
for (const name of pending) {
  const request = git(['show', `pending/default:pending/${name}/request.md`])
  const runLine = request.match(/^Run:\s*(\S+)\s+in\s+(\S+)\s*$/m)
  const reportLine = request.match(/^Report:\s*(\S+)\s*$/m)
  if (!runLine && !reportLine) throw new Error(`request ${name} has no 'Run:' or 'Report:' line`)
  const run = new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()
  const capCommit = git(['rev-parse', capability])
  // The unit's record: what was invoked, and every state it ran on, by
  // commit, taken before anything changes. With these a rerun reproduces it.
  const unit = {
    invocation: { request: name, line: (runLine || reportLine)[0] },
    state: Object.fromEntries(['pending/default', 'main', 'execute/main', capability]
      .map(b => [b, git(['rev-parse', b])])),
    environment: { node: process.version, git: git(['--version']), platform: `${process.platform}-${process.arch}` }
  }
  const work = mkdtempSync(join(tmpdir(), 'execute-'))

  try {
    // 1. Extract the deployed capability tree.
    const code = join(work, 'code')
    mkdirSync(code)
    const archive = spawnSync('git', ['archive', capability], { cwd: repo, maxBuffer: 1 << 30 })
    if (archive.status !== 0) throw new Error('git archive failed')
    const untar = spawnSync('tar', ['-x', '-C', code], { input: archive.stdout })
    if (untar.status !== 0) throw new Error('tar failed')

    // 2. Run, and commit the output to pending/default.
    const pendingWt = join(work, 'pending')
    git(['worktree', 'add', '-q', pendingWt, 'pending/default'])
    const runDir = join(pendingWt, 'pending', name, 'runs', run)
    mkdirSync(runDir, { recursive: true })
    const started = new Date().toISOString()
    const done = runLine
      ? runTests(code, work, runDir, runLine[1], runLine[2])
      : makeReport(code, runDir, reportLine[1])
    const { verdict, summary } = done
    if (verdict !== 'pass') anyFailed = true
    writeFileSync(join(runDir, 'run.json'), JSON.stringify({
      request: name, run, capability, capabilityCommit: capCommit, ...done.what,
      started, finished: new Date().toISOString(), verdict, ...summary,
      runtime: { node: process.version, git: git(['--version']) },
      unit: { ...unit, nondeterministic: { run, started, workDir: work } }
    }, null, 2) + '\n')
    git(['add', '.'], { cwd: pendingWt })
    git(['commit', '-q', '-m', `Run ${name}: ${verdict}${done.headline ? ', ' + done.headline : ''}\n\n` +
      `Execution data of request pending/${name}, run from ${capability}@${capCommit.slice(0, 7)}.`],
    { cwd: pendingWt })
    const pendingCommit = git(['rev-parse', '--short', 'HEAD'], { cwd: pendingWt })
    git(['worktree', 'remove', pendingWt])

    // 3. Respond on execute/main, merge into main.
    const execWt = join(work, 'execute')
    git(['worktree', 'add', '-q', execWt, 'execute/main'])
    git(['merge', '-q', '--no-edit', 'main'], { cwd: execWt })
    mkdirSync(join(execWt, 'responses'), { recursive: true })
    writeFileSync(join(execWt, 'responses', `${name}.md`),
      `# Response: ${name}\n\nVerdict: **${verdict}** — ${done.outcome}\n\n` +
      `Run \`${run}\` from \`${capability}\` at \`${capCommit.slice(0, 7)}\`.\n\n` +
      `Details: \`${pendingCommit}:pending/${name}/runs/${run}/\`\n` +
      (done.body ? '\n' + done.body : ''))
    git(['add', '.'], { cwd: execWt })
    git(['commit', '-q', '-m', `Respond to ${name}: ${verdict}\n\nRequest: ${pendingCommit}:pending/${name}/request.md\n` +
      `Details: ${pendingCommit}:pending/${name}/runs/${run}/`], { cwd: execWt })
    git(['worktree', 'remove', execWt])

    // Plain merge into main, from main's own worktree if it is checked out.
    mergeIntoMain(name, pendingCommit)
    console.log(JSON.stringify({ request: name, run, verdict, ...summary }))
  } finally {
    // Remove the folder first, so prune drops worktrees a failure left behind.
    rmSync(work, { recursive: true, force: true })
    git(['worktree', 'prune'])
  }
}
process.exit(anyFailed ? 1 : 0)

// Run a tests file through the deployed runner.
// pass: all tests passed; fail: tests ran, some failed;
// error: the runner did not complete, so there are no results to trust.
function runTests (code, work, runDir, testsPath, folder) {
  let testsFile = join(code, testsPath)
  if (testsPath.startsWith('pending/')) {
    // A missing file stays missing, so the runner reports the error.
    testsFile = join(work, 'tests.txt')
    const tests = git(['show', `pending/default:${testsPath}`], { allowFail: true })
    if (tests !== null) writeFileSync(testsFile, tests + '\n')
  }
  const r = spawnSync('node', [join(code, 'runner.js'), testsFile, join(code, folder),
    join(runDir, 'results.jsonl')], { encoding: 'utf8' })
  let summary = {}
  try { summary = JSON.parse(r.stdout.trim().split('\n').pop()) } catch {}
  const completed = (r.status === 0 || r.status === 1) && typeof summary.tests === 'number'
  const verdict = !completed ? 'error' : r.status === 0 ? 'pass' : 'fail'
  if (!completed) summary = { tests: 0, passed: 0, failed: 0, runnerExit: r.status, runnerError: r.stderr.trim() }
  return {
    verdict, summary, what: { testsFile: testsPath, folder },
    headline: `${summary.passed}/${summary.tests} passed`,
    outcome: verdict === 'error' ? `the runner did not complete (exit ${summary.runnerExit}).`
      : `${summary.passed} of ${summary.tests} tests passed.`
  }
}

// Report on this repository with the deployed report.js; the report is
// kept with the run and is the body of the response.
function makeReport (code, runDir, scope) {
  const r = spawnSync('node', [join(code, 'report.js'), repo, scope], { encoding: 'utf8' })
  if (r.status !== 0) {
    return {
      verdict: 'error', summary: { reportExit: r.status, reportError: (r.stderr || '').trim() },
      what: { report: scope }, outcome: `the report could not be made (exit ${r.status}).`
    }
  }
  writeFileSync(join(runDir, 'report.md'), r.stdout)
  return { verdict: 'pass', summary: {}, what: { report: scope }, outcome: 'report made.', body: r.stdout }
}

function mergeIntoMain (name, pendingCommit) {
  const message = `Merge execute/main: response to ${name}\n\nRequest: ${pendingCommit}:pending/${name}/request.md`
  const current = git(['symbolic-ref', '--short', '-q', 'HEAD'], { allowFail: true })
  if (current === 'main') {
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
    if (existsSync(wt)) rmSync(wt, { recursive: true, force: true })
  }
}
