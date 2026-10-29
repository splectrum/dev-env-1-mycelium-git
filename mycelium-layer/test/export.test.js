import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fixture } from '../../mycelium-git/test/contract.js'
import { nativeBackend, isogitBackend, p2pgitBackend, openRepo, writer, writeBundle } from '../../mycelium-git/index.js'
import { exportLayer, importBundle } from '../index.js'

const author = { name: 'test', email: 'test@localhost' }
const time = '2026-01-02T00:00:00Z'
const tmp = name => join(mkdtempSync(join(tmpdir(), 'export-')), name)
const engines = [nativeBackend, isogitBackend, p2pgitBackend]

test('export a layer from every engine, import it into every engine', async () => {
  for (const makeFrom of engines) {
    const from = makeFrom(fixture())
    const w = writer(from)
    await w.createLayer('data/sets', 'Create', { author, time })
    const c = await w.change('data/sets')
    await c.put('/one.md', 'one')
    const commit = await c.commit('Put', { author, time })
    const file = tmp('sets.bundle')
    assert.equal((await exportLayer({ backend: from, layer: 'data/sets', file })).commit, commit)
    for (const makeTo of engines) {
      const to = makeTo(fixture())
      const r = await importBundle({ backend: to, file })
      assert.deepEqual(r, { commit, objects: 5 }, `${makeFrom.name} → ${makeTo.name}`)
      assert.equal((await openRepo(to).read('/data/sets/one.md')).toString(), 'one')
      await importBundle({ backend: to, file, as: 'data/again' })
      await assert.rejects(importBundle({ backend: to, file, as: 'other/x' }), /not a layer/)
    }
  }
})

test('import-bundle refusals', async () => {
  const from = nativeBackend(fixture())
  const file = tmp('all.bundle')
  const { writeFileSync } = await import('node:fs')
  writeFileSync(file, await writeBundle(from, Object.fromEntries(await from.listBranches())))
  const to = nativeBackend(fixture())
  await assert.rejects(importBundle({ backend: to, file }), /name a branch/)
  await assert.rejects(importBundle({ backend: to, file, branch: 'data/nope' }), /not in the bundle/)
  await assert.rejects(exportLayer({ backend: from, layer: 'data/nope', file: tmp('x') }), /no branch/)
})
