import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { fixture } from '../../mycelium-git/test/contract.js'
import { nativeBackend, isogitBackend, p2pgitBackend, openRepo } from '../../mycelium-git/index.js'
import { intake } from '../index.js'

const folder = fileURLToPath(new URL('./request', import.meta.url))
const author = { name: 'test', email: 'test@localhost' }
const time = '2026-01-02T00:00:00Z'

test('intake: a request into pending/default, once, the same on every engine', async () => {
  const commits = []
  for (const make of [nativeBackend, isogitBackend, p2pgitBackend]) {
    const backend = make(fixture())
    const r = await intake({ backend, folder, name: 'r2', author, time })
    assert.equal(r.files, 3)
    commits.push(r.commit)
    const repo = openRepo(backend)
    assert.equal((await repo.read('/pending/default/pending/r2/data/x.md')).toString(), 'x\n')
    assert.deepEqual((await repo.select('/pending/default/pending/*')).map(([p]) => p),
      ['/pending/default/pending/r1', '/pending/default/pending/r2'])
    await assert.rejects(intake({ backend, folder, name: 'r2', author, time }), /request exists: r2/)
    await assert.rejects(intake({ backend, folder, name: 'r1', author, time }), /request exists: r1/)
  }
  assert.equal(new Set(commits).size, 1)
})
