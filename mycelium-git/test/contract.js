// The contract suite: the same tests, run against every backend.
//   contract(name, makeBackend), makeBackend(gitdir) → backend
// Each run builds the fixture repository (test/fixture.sh).

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { openRepo, pinned, writer } from '../index.js'
import { sameName } from '../../mycelium-uri/index.js'

export function fixture () {
  const dir = join(mkdtempSync(join(tmpdir(), 'mycelium-git-')), 'repo')
  execFileSync('sh', [new URL('./fixture.sh', import.meta.url).pathname, dir])
  return dir
}

const paths = found => found.map(([p]) => p)
const author = { name: 'test', email: 'test@localhost' }
const time = '2026-01-02T00:00:00Z'

export function contract (name, makeBackend) {
  // Reading: one fixture, never written.
  let repo, backend
  before(() => {
    backend = makeBackend(fixture())
    repo = openRepo(backend)
  })
  test(`${name}: above the branches: name segments`, async () => {
    assert.deepEqual(paths(await repo.select('/*')), ['/execute', '/main', '/overlay', '/pending'])
    assert.deepEqual(paths(await repo.select('/pending/*')), ['/pending/default'])
    assert.deepEqual(paths(await repo.select('/*/*')),
      ['/execute/main', '/main/README.md', '/main/docs', '/main/readme', '/overlay/config', '/pending/default'])
  })

  test(`${name}: into a branch`, async () => {
    assert.deepEqual(paths(await repo.select('/main/*')), ['/main/README.md', '/main/docs', '/main/readme'])
    assert.deepEqual(paths(await repo.select('/pending/default/pending/*')), ['/pending/default/pending/r1'])
    assert.deepEqual(paths(await repo.select('/*/docs/a')), ['/main/docs/a'])
    assert.deepEqual(paths(await repo.select('/*/*/docs/a')), ['/execute/main/docs/a', '/overlay/config/docs/a'])
    assert.deepEqual(await repo.select('/main/nope'), [])
  })

  test(`${name}: read`, async () => {
    assert.equal((await repo.read('/main/readme')).toString(), 'hello')
    assert.equal((await repo.read('/overlay/config/docs/a')).toString(), 'conf')
    assert.equal((await repo.read('/main/README.md')).toString(), 'convention')
    await assert.rejects(repo.read('/main/readme.md'), /not a file/)
    assert.equal((await repo.read('/main/readme.md', sameName)).toString(), 'convention')
    await assert.rejects(repo.read('/main/docs'), /not a file/)
    await assert.rejects(repo.read('/main/nope'), /not a file/)
  })

  test(`${name}: pinned: a repository at a recorded state`, async () => {
    const branches = Object.fromEntries(await backend.listBranches())
    const old = openRepo(pinned(backend, { main: branches.main }))
    assert.deepEqual(paths(await old.select('/*')), ['/main'])
    assert.equal((await old.read('/main/readme')).toString(), 'hello')
  })

  // Writing: a fixture of its own, written in sequence.
  let wb, wrepo, w
  before(() => {
    wb = makeBackend(fixture())
    wrepo = openRepo(wb)
    w = writer(wb)
  })
  const head = async b => Object.fromEntries(await wb.listBranches())[b]
  const text = async p => (await wrepo.read(p)).toString()

  test(`${name}: change: put and remove, one commit`, async () => {
    const before = await head('main')
    const c = await w.change('main')
    await c.put('/notes/one.md', 'one')
    await c.put('/notes/two.md', 'two')
    await c.put('/readme', 'changed')
    c.remove('/docs/b')
    const oid = await c.commit('Change main', { author, time })
    assert.equal(await head('main'), oid)
    assert.deepEqual((await wb.readCommit(oid)).parents, [before])
    assert.equal(await text('/main/notes/two.md'), 'two')
    assert.equal(await text('/main/readme'), 'changed')
    assert.deepEqual((await wrepo.select('/main/docs/*')).map(([p]) => p), ['/main/docs/a'])
  })

  test(`${name}: change: emptied folders disappear`, async () => {
    const c = await w.change('main')
    c.remove('/notes/one.md')
    c.remove('/notes/two.md')
    await c.commit('Remove notes', { author, time })
    assert.deepEqual(await wrepo.select('/main/notes'), [])
  })

  test(`${name}: change: conflicts and missing paths throw`, async () => {
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

  test(`${name}: change: a concurrent change fails, nothing is overwritten`, async () => {
    const a = await w.change('main')
    const b = await w.change('main')
    await a.put('/a', 'a')
    await b.put('/b', 'b')
    await a.commit('a', { author, time })
    await assert.rejects(b.commit('b', { author, time }))
    assert.deepEqual(await wrepo.select('/main/b'), [])
  })

  test(`${name}: merge: plain merge commit, nothing to do when merged`, async () => {
    const main = await head('main')
    await w.merge('main', 'execute/main', 'sync', { author, time, fastForward: true })
    const c = await w.change('execute/main')
    await c.put('/responses/r1.md', 'done')
    const exec = await c.commit('Respond', { author, time })
    const m = await w.merge('execute/main', 'main', 'Merge execute/main', { author, time })
    assert.deepEqual((await wb.readCommit(m)).parents, [main, exec])
    assert.equal(await text('/main/responses/r1.md'), 'done')
    assert.equal(await w.merge('execute/main', 'main', 'again', { author, time }), m)
  })

  test(`${name}: merge: fast-forward only when asked`, async () => {
    const main = await head('main')
    assert.equal(await w.merge('main', 'execute/main', 'sync', { author, time, fastForward: true }), main)
    assert.equal(await head('execute/main'), main)
  })

  test(`${name}: merge: disjoint layers are never merged`, async () => {
    await assert.rejects(w.merge('overlay/config', 'main', 'm', { author, time }), /disjoint layers/)
  })

  test(`${name}: merge: conflicts throw`, async () => {
    await wb.updateBranch('side', await head('main'), null)
    const a = await w.change('main')
    await a.put('/readme', 'main says')
    await a.commit('a', { author, time })
    const b = await w.change('side')
    await b.put('/readme', 'side says')
    await b.commit('b', { author, time })
    await assert.rejects(w.merge('side', 'main', 'm', { author, time }), /merge conflicts: readme/)
  })
}
