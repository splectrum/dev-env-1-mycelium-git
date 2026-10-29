// split against native git subtree split, the reference, on a history with
// a folder changed on both sides of a merge and commits that don't touch it.
// Every engine gives native's split commits.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fixture } from './contract.js'
import { nativeBackend, isogitBackend, p2pgitBackend, writer, split, openRepo } from '../index.js'

const author = { name: 'test', email: 'test@localhost' }
let n = 0
const time = () => `2026-01-02T00:00:${String(n++).padStart(2, '0')}Z`

async function history (dir) {
  const b = nativeBackend(dir)
  const w = writer(b)
  const put = async (branch, path, text) => {
    const c = await w.change(branch)
    await c.put(path, text)
    return c.commit(`Put ${path} on ${branch}`, { author, time: time() })
  }
  await put('main', '/pkg/a.md', 'a')
  await put('main', '/other/x.md', 'x')
  await w.merge('main', 'execute/main', 'Sync', { author, time: time(), fastForward: true })
  await put('execute/main', '/pkg/b.md', 'b')
  await put('main', '/pkg/c.md', 'c')
  await w.merge('execute/main', 'main', 'Merge execute/main', { author, time: time() })
  await put('main', '/other/y.md', 'y')
  return Object.fromEntries(await b.listBranches()).main
}

test('split: the same commits as git subtree split, on every engine', async () => {
  const dir = fixture()
  const main = await history(dir)
  const work = join(mkdtempSync(join(tmpdir(), 'split-')), 'work')
  execFileSync('git', ['clone', '-q', '-b', 'main', dir, work])
  const reference = execFileSync('git', ['-C', work, 'subtree', 'split', '-q', '--prefix=pkg', 'main'])
    .toString().trim()
  for (const make of [nativeBackend, isogitBackend, p2pgitBackend]) {
    assert.equal(await split(make(dir), main, 'pkg'), reference, make.name)
  }
  // The split holds the folder alone, with its history: a, then b and c on
  // two sides of a merge.
  const b = nativeBackend(dir)
  await writer(b).advance('publish/pkg', reference)
  assert.deepEqual((await openRepo(b).select('/publish/pkg/*')).map(([p]) => p),
    ['/publish/pkg/a.md', '/publish/pkg/b.md', '/publish/pkg/c.md'])
  assert.equal((await b.readCommit(reference)).parents.length, 2)
  assert.equal(await split(b, main, 'nope'), null)
})
