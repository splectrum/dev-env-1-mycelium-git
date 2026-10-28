#!/usr/bin/env node
// Report: interprets the record. For every executed Run request it compares
// each recorded invocation with the expectation the request gave for it.
//   node report.js <repo> runs
// Expectations are on the test lines, after '=>':
//   => <json>        the last JSON line of the output must equal it
//   => exit <code>   the exit code must be <code> ('null': did not start)
// Reads the repository only, at the states each run recorded; prints markdown.

import { spawnSync } from 'node:child_process'
import { isDeepStrictEqual } from 'node:util'

const [repo, scope] = process.argv.slice(2)
if (!repo || scope !== 'runs') {
  console.error('usage: report.js <repo> runs')
  process.exit(2)
}

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 30 })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.trim()}`)
  return r.stdout
}
const exists = spec => spawnSync('git', ['cat-file', '-e', spec], { cwd: repo }).status === 0
const lines = text => text.split('\n').filter(Boolean)

const out = ['# Test report', '']
const totals = { requests: 0, invocations: 0, met: 0, unmet: 0, unchecked: 0, incomplete: 0 }

for (const name of exists('main:responses') ? lines(git('ls-tree', '-d', '--name-only', 'main:responses/')) : []) {
  const base = `main:responses/${name}`
  if (!exists(`${base}/unit.json`)) continue
  const unit = JSON.parse(git('show', `${base}/unit.json`))
  const m = (unit.invocation.line || '').match(/^Run:\s*(\S+)\s+in\s+(\S+)/)
  if (!m) continue
  totals.requests++
  const [, testsPath, folder] = m
  const cap = Object.keys(unit.state).find(b => b.startsWith('capability/'))
  out.push(`## ${name}`, '', `\`${testsPath}\` in \`${folder}\`, from \`${cap}\` at \`${unit.state[cap].slice(0, 7)}\`.`, '')

  if (!exists(`${base}/results.jsonl`) || exists(`${base}/error.txt`)) {
    totals.incomplete++
    out.push('**Did not complete.** No record of invocations to check.', '')
    continue
  }

  // The expectations, from the tests file at the state the run recorded.
  const testsAt = testsPath.startsWith('pending/') ? unit.state['pending/default'] : unit.state[cap]
  const testLines = git('show', `${testsAt}:${testsPath}`).split('\n')
  const rows = []
  const counts = { met: 0, unmet: 0, unchecked: 0 }
  for (const rec of lines(git('show', `${base}/results.jsonl`)).map(l => JSON.parse(l))) {
    const expectation = (testLines[rec.line - 1].split('=>')[1] || '').trim()
    const verdict = check(rec, expectation)
    counts[verdict.status]++
    if (verdict.status !== 'met') {
      rows.push(`| ${rec.line} | \`${rec.command.join(' ')}\` | ${expectation ? '`' + expectation + '`' : '—'} | \`${verdict.got}\` | ${verdict.status} |`)
    }
  }
  totals.invocations += counts.met + counts.unmet + counts.unchecked
  for (const k of Object.keys(counts)) totals[k] += counts[k]
  out.push(`${counts.met} met, ${counts.unmet} not met, ${counts.unchecked} without expectation.`, '')
  if (rows.length) {
    out.push('| Line | Invocation | Expected | Got | |', '|---|---|---|---|---|', ...rows, '')
  }
}

out.push('## Summary', '',
  `${totals.requests} requests, ${totals.invocations} invocations: ${totals.met} met, ` +
  `${totals.unmet} not met, ${totals.unchecked} without expectation; ${totals.incomplete} requests did not complete.`, '')
console.log(out.join('\n'))

function check (rec, expectation) {
  const last = lines(rec.stdout || '').pop()
  let response
  try { response = JSON.parse(last) } catch { response = undefined }
  const got = rec.code === 0 || response !== undefined ? (last ?? `exit ${rec.code}`) : `exit ${rec.code}`
  if (!expectation) return { status: 'unchecked', got }
  const exit = expectation.match(/^exit\s+(\S+)$/)
  if (exit) {
    const want = exit[1] === 'null' ? null : Number(exit[1])
    return { status: rec.code === want ? 'met' : 'unmet', got: `exit ${rec.code}` }
  }
  let want
  try { want = JSON.parse(expectation) } catch { return { status: 'unmet', got: 'bad expectation' } }
  return { status: isDeepStrictEqual(response, want) ? 'met' : 'unmet', got }
}
