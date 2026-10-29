import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { nativeBackend, isogitBackend, p2pgitBackend, openRepo } from '../../mycelium-git/index.js'
import { seed } from '../index.js'

const template = fileURLToPath(new URL('./template', import.meta.url))
const author = { name: 'test', email: 'test@localhost' }
const time = '2026-01-02T00:00:00Z'
const fresh = () => join(mkdtempSync(join(tmpdir(), 'seed-')), 'repo')

test('seed: the same repository from a template, on every engine', async () => {
  const results = []
  for (const make of [nativeBackend, isogitBackend, p2pgitBackend]) {
    const backend = make(fresh())
    const seeded = await seed({ backend, template, source: 'test/template', author, time })
    assert.deepEqual(Object.keys(seeded).sort(), ['execute/main', 'main', 'overlay/config', 'pending/default'])
    assert.equal(seeded['execute/main'], seeded.main)
    const repo = openRepo(backend)
    assert.equal((await repo.read('/main/readme.md')).toString(), '# Seeded\n')
    assert.equal((await repo.read('/pending/default/pending/r1/request.md')).toString(), '# Request: r1\n')
    assert.equal((await backend.readCommit(seeded.main)).message, 'Seed main from test/template\n')
    results.push(seeded)
    await assert.rejects(seed({ backend, template, author, time }), /not a new repository/)
  }
  assert.deepEqual(results[1], results[0])
  assert.deepEqual(results[2], results[0])
})
