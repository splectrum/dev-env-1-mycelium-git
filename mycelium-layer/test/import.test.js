import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../mycelium-git/test/contract.js'
import { nativeBackend, p2pgitBackend, openRepo, writer } from '../../mycelium-git/index.js'
import { importLayer } from '../index.js'

const author = { name: 'test', email: 'test@localhost' }
const time = '2026-01-02T00:00:00Z'

async function source () {
  const from = nativeBackend(fixture())
  const w = writer(from)
  await w.createLayer('data/sets', 'Create', { author, time })
  const c = await w.change('data/sets')
  await c.put('/one.md', 'one')
  await c.commit('Put', { author, time })
  return { from, w }
}

test('import a layer, then again after it moved on', async () => {
  const { from, w } = await source()
  const to = p2pgitBackend(fixture())
  const first = await importLayer({ from, to, branch: 'data/sets' })
  assert.equal(first.copied, 4)
  assert.equal((await openRepo(to).read('/data/sets/one.md')).toString(), 'one')

  const c = await w.change('data/sets')
  await c.put('/two.md', 'two')
  await c.commit('Put', { author, time })
  const second = await importLayer({ from, to, branch: 'data/sets' })
  assert.equal(second.copied, 3)
  assert.equal((await openRepo(to).read('/data/sets/two.md')).toString(), 'two')
})

test('import under another name; refusals', async () => {
  const { from } = await source()
  const to = nativeBackend(fixture())
  await importLayer({ from, to, branch: 'data/sets', as: 'data/theirs' })
  assert.equal((await openRepo(to).read('/data/theirs/one.md')).toString(), 'one')
  await assert.rejects(importLayer({ from, to, branch: 'data/nope' }), /no branch: data\/nope/)
  await assert.rejects(importLayer({ from, to, branch: 'data/sets', as: 'other/x' }), /not a layer/)
  // main exists on both sides with different histories: it can't be taken in.
  const w = writer(from)
  const c = await w.change('main')
  await c.put('/x.md', 'x')
  await c.commit('Put', { author, time })
  const t = await writer(to).change('main')
  await t.put('/y.md', 'y')
  await t.commit('Put', { author, time })
  await assert.rejects(importLayer({ from, to, branch: 'main' }), /diverged: main/)
})
