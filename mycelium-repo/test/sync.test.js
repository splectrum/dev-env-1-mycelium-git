import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fixture } from '../../mycelium-git/test/contract.js'
import { nativeBackend, isogitBackend, openRepo, writer } from '../../mycelium-git/index.js'
import { sync } from '../index.js'

const author = { name: 'test', email: 'test@localhost' }
const time = '2026-01-02T00:00:00Z'
const empty = () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'remote-')), 'repo')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', dir])
  return dir
}
const put = async (b, branch, path, text) => {
  const c = await writer(b).change(branch)
  await c.put(path, text)
  return c.commit(`Put ${path}`, { author, time })
}

test('sync: created, same, advanced, remote ahead, diverged, remote only', async () => {
  const repo = nativeBackend(fixture())
  const remote = isogitBackend(empty())
  assert.deepEqual(await sync({ repo, remote }), {
    'execute/main': 'created', main: 'created', 'overlay/config': 'created', 'pending/default': 'created'
  })
  assert.equal((await openRepo(remote).read('/main/readme')).toString(), 'hello')

  await put(repo, 'main', '/a.md', 'a')
  await put(remote, 'overlay/config', '/theirs.md', 'theirs')
  await put(repo, 'pending/default', '/ours.md', 'ours')
  await put(remote, 'pending/default', '/theirs.md', 'theirs')
  await writer(remote).createLayer('data/elsewhere', 'Create', { author, time })
  assert.deepEqual(await sync({ repo, remote }), {
    'execute/main': 'same',
    main: 'advanced',
    'overlay/config': 'remote-ahead',
    'pending/default': 'diverged',
    'data/elsewhere': 'remote-only'
  })
  assert.equal((await openRepo(remote).read('/main/a.md')).toString(), 'a')
  assert.deepEqual(await openRepo(remote).select('/pending/default/ours.md'), [])
})
