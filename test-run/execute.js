#!/usr/bin/env node
// Execution hook: checks pending/default for requests not yet answered and
// executes them from the deployed capability branch.
//   node execute.js <repo> [capability-branch]   (default: capability/test)
//
// A request is pending/<name>/request.md. Its 'Run:' line names a tests file
// and the folder to run it from, both in the capability tree:
//   Run: mycelium-uri/test/commands.txt in mycelium-uri
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
  const m = request.match(/^Run:\s*(\S+)\s+in\s+(\S+)\s*$/m)
  if (!m) throw new Error(`request ${name} has no 'Run: <tests> in <folder>' line`)
  const [, testsPath, folder] = m
  const run = new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()
  const capCommit = git(['rev-parse', capability])
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
    const r = spawnSync('node', [join(code, 'runner.js'), join(code, testsPath), join(code, folder),
      join(runDir, 'results.jsonl')], { encoding: 'utf8' })
    const summary = JSON.parse(r.stdout.trim().split('\n').pop() || '{}')
    const verdict = r.status === 0 ? 'pass' : 'fail'
    if (verdict === 'fail') anyFailed = true
    writeFileSync(join(runDir, 'run.json'), JSON.stringify({
      request: name, run, capability, capabilityCommit: capCommit, tests: testsPath, folder,
      started, finished: new Date().toISOString(), verdict, ...summary,
      runtime: { node: process.version, git: git(['--version']) }
    }, null, 2) + '\n')
    git(['add', '.'], { cwd: pendingWt })
    git(['commit', '-q', '-m', `Run ${name}: ${verdict}, ${summary.passed}/${summary.tests} passed\n\n` +
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
      `# Response: ${name}\n\nVerdict: **${verdict}** — ${summary.passed} of ${summary.tests} tests passed.\n\n` +
      `Run \`${run}\` from \`${capability}\` at \`${capCommit.slice(0, 7)}\`.\n\n` +
      `Details: \`${pendingCommit}:pending/${name}/runs/${run}/\`\n`)
    git(['add', '.'], { cwd: execWt })
    git(['commit', '-q', '-m', `Respond to ${name}: ${verdict}\n\nRequest: ${pendingCommit}:pending/${name}/request.md\n` +
      `Details: ${pendingCommit}:pending/${name}/runs/${run}/`], { cwd: execWt })
    git(['worktree', 'remove', execWt])

    // Plain merge into main, from main's own worktree if it is checked out.
    mergeIntoMain(name, pendingCommit)
    console.log(JSON.stringify({ request: name, run, verdict, ...summary }))
  } finally {
    git(['worktree', 'prune'])
    rmSync(work, { recursive: true, force: true })
  }
}
process.exit(anyFailed ? 1 : 0)

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
