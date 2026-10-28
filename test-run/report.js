#!/usr/bin/env node
// Report on a repository's own requests and runs, from its own contents.
//   node report.js <repo> runs
// Prints markdown: the branches, then per request on pending/default its
// runs with verdicts, and the tests that failed. Reads only; changes nothing.

import { spawnSync } from 'node:child_process'

const [repo, scope] = process.argv.slice(2)
if (!repo || scope !== 'runs') {
  console.error('usage: report.js <repo> runs')
  process.exit(2)
}

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 30 })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.trim()}`)
  return r.stdout.trim()
}
const lines = text => text.split('\n').filter(Boolean)
const exists = spec => spawnSync('git', ['cat-file', '-e', spec], { cwd: repo }).status === 0

const out = ['# Report: runs', '']

out.push('## Branches', '', '| Branch | Head | Commits |', '|---|---|---|')
for (const line of lines(git('for-each-ref', '--format=%(refname:short) %(objectname:short)', 'refs/heads'))) {
  const [branch, head] = line.split(' ')
  out.push(`| \`${branch}\` | \`${head}\` | ${git('rev-list', '--count', branch)} |`)
}
out.push('')

out.push('## Requests', '')
let runs = 0
let notPassed = 0
for (const name of lines(git('ls-tree', '-d', '--name-only', 'pending/default:pending'))) {
  const base = `pending/default:pending/${name}`
  if (!exists(`${base}/request.md`)) continue
  const title = git('show', `${base}/request.md`).split('\n')[0].replace(/^#\s*/, '')
  const answered = exists(`main:responses/${name}.md`)
  out.push(`### ${name}`, '', `${title}. ${answered ? 'Answered on `main`.' : 'Not answered yet.'}`, '')

  const runIds = exists(`${base}/runs`) ? lines(git('ls-tree', '-d', '--name-only', `${base}/runs/`)) : []
  if (runIds.length === 0) { out.push('No runs.', ''); continue }

  out.push('| Run | Verdict | Tests | Capability |', '|---|---|---|---|')
  const failures = []
  for (const id of runIds) {
    const run = JSON.parse(git('show', `${base}/runs/${id}/run.json`))
    runs++
    if (run.verdict !== 'pass') notPassed++
    const tests = typeof run.tests === 'number' ? `${run.passed}/${run.tests}` : '—'
    out.push(`| \`${id}\` | ${run.verdict} | ${tests} | \`${run.capability}@${run.capabilityCommit.slice(0, 7)}\` |`)
    if (run.verdict === 'error') failures.push(`- \`${id}\`: did not complete (exit ${run.runnerExit ?? run.reportExit})`)
    if (exists(`${base}/runs/${id}/results.jsonl`)) {
      for (const l of lines(git('show', `${base}/runs/${id}/results.jsonl`))) {
        const t = JSON.parse(l)
        if (!t.pass) failures.push(`- \`${id}\` line ${t.line}: \`${t.command.join(' ')}\` expected ${t.expect}, got ${t.got} (exit ${t.code})`)
      }
    }
  }
  out.push('')
  if (failures.length) out.push('Not passed:', '', ...failures, '')
}

out.push('## Summary', '', `${runs} runs, ${runs - notPassed} passed, ${notPassed} not passed.`, '')
console.log(out.join('\n'))
