import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { nativeBackend, openRepo, writer } from '../index.js'

const author = { name: 'test', email: 'test@localhost' }
const time = '2026-01-02T00:00:00Z'
let backend, repo, w
before(() => {
  const dir = join(mkdtempSync(join(tmpdir(), 'mycelium-git-')), 'repo')
  execFileSync('sh', [new URL('./fixture.sh', import.meta.url).pathname, dir])
  backend = nativeBackend(dir)
  repo = openRepo(backend)
  w = writer(backend)
})
const head = async b => Object.fromEntries(await backend.listBranches())[b]
const text = async p => (await repo.read(p)).toString()

test('change: put and remove, one commit', async () => {
  const before = await head('main')
  const c = await w.change('main')
  await c.put('/notes/one.md', 'one')
  await c.put('/notes/two.md', 'two')
  await c.put('/readme', 'changed')
  c.remove('/docs/b')
  const oid = await c.commit('Change main', { author, time })
  assert.equal(await head('main'), oid)
  assert.deepEqual((await backend.readCommit(oid)).parents, [before])
  assert.equal(await text('/main/notes/two.md'), 'two')
  assert.equal(await text('/main/readme'), 'changed')
  assert.deepEqual((await repo.select('/main/docs/*')).map(([p]) => p), ['/main/docs/a'])
})

test('change: emptied folders disappear', async () => {
  const c = await w.change('main')
  c.remove('/notes/one.md')
  c.remove('/notes/two.md')
  await c.commit('Remove notes', { author, time })
  assert.deepEqual(await repo.select('/main/notes'), [])
})

test('change: conflicts and missing paths throw', async () => {
  const a = await w.change('main')
  await a.put('/docs', 'file over folder')
  await assert.rejects(a.commit('x', { author, time }), /conflict: \/docs is a folder/)
  const b = await w.change('main')
  await b.put('/readme/x', 'folder under file')
  await assert.rejects(b.commit('x', { author, time }), /conflict: \/readme is a file/)
  const c = await w.change('main')
  c.remove('/nope')
  await assert.rejects(c.commit('x', { author, time }), /not found: \/nope/)
  await assert.rejects(w.change('nope'), /no branch: nope/)
})

test('change: a concurrent change fails, nothing is overwritten', async () => {
  const a = await w.change('main')
  const b = await w.change('main')
  await a.put('/a', 'a')
  await b.put('/b', 'b')
  await a.commit('a', { author, time })
  await assert.rejects(b.commit('b', { author, time }))
  assert.deepEqual(await repo.select('/main/b'), [])
})

test('merge: plain merge commit, nothing to do when merged', async () => {
  const main = await head('main')
  await w.merge('main', 'execute/main', 'sync', { author, time, fastForward: true })
  const c = await w.change('execute/main')
  await c.put('/responses/r1.md', 'done')
  const exec = await c.commit('Respond', { author, time })
  const m = await w.merge('execute/main', 'main', 'Merge execute/main', { author, time })
  assert.deepEqual((await backend.readCommit(m)).parents, [main, exec])
  assert.equal(await text('/main/responses/r1.md'), 'done')
  assert.equal(await w.merge('execute/main', 'main', 'again', { author, time }), m)
})

test('merge: fast-forward only when asked', async () => {
  const main = await head('main')
  assert.equal(await w.merge('main', 'execute/main', 'sync', { author, time, fastForward: true }), main)
  assert.equal(await head('execute/main'), main)
})

test('merge: disjoint layers are never merged', async () => {
  await assert.rejects(w.merge('overlay/config', 'main', 'm', { author, time }), /disjoint layers/)
})

test('merge: conflicts throw', async () => {
  await backend.updateBranch('side', await head('main'), null)
  const a = await w.change('main')
  await a.put('/readme', 'main says')
  await a.commit('a', { author, time })
  const b = await w.change('side')
  await b.put('/readme', 'side says')
  await b.commit('b', { author, time })
  await assert.rejects(w.merge('side', 'main', 'm', { author, time }), /merge conflicts: readme/)
})
