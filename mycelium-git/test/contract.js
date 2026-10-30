// The contract suite: the same tests, run against every backend.
//   contract(name, makeBackend), makeBackend(gitdir) → backend (or a promise)
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
  before(async () => {
    backend = await makeBackend(fixture())
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
  before(async () => {
    wb = await makeBackend(fixture())
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

  test(`${name}: createLayer: orphans under layer segments, leaves only`, async () => {
    const oid = await w.createLayer('data/sets', 'Create data/sets', { author, time })
    assert.deepEqual((await wb.readCommit(oid)).parents, [])
    assert.deepEqual(await wrepo.select('/data/sets/*'), [])
    await assert.rejects(w.createLayer('data/sets', 'x', { author, time }), /exists: data\/sets/)
    await assert.rejects(w.createLayer('data/sets/more', 'x', { author, time }), /not a leaf/)
    await assert.rejects(w.createLayer('overlay', 'x', { author, time }), /not a layer: overlay/)
    await assert.rejects(w.createLayer('overlay/config/x', 'x', { author, time }), /not a leaf/)
    await assert.rejects(w.createLayer('execute/main', 'x', { author, time }), /not a layer/)
    await assert.rejects(w.createLayer('publish/x', 'x', { author, time }), /not a layer/)
    await assert.rejects(w.createLayer('main/x', 'x', { author, time }), /not a layer/)
    await assert.rejects(w.createLayer('other/x', 'x', { author, time }), /not a layer/)
  })

  test(`${name}: createExecution and deleteBranch: only once merged`, async () => {
    const c = await w.change('data/sets')
    await c.put('/a.md', 'a')
    await c.commit('Put', { author, time })
    const from = await w.createExecution('data/sets')
    assert.equal(await head('execute/data/sets'), from)
    await assert.rejects(w.createExecution('data/sets'), /exists/)
    await assert.rejects(w.createExecution('nope'), /no branch: nope/)
    const d = await w.change('execute/data/sets')
    await d.put('/b.md', 'b')
    await d.commit('Respond', { author, time })
    await assert.rejects(w.deleteBranch('execute/data/sets', 'data/sets'), /not merged/)
    await w.merge('execute/data/sets', 'data/sets', 'Merge', { author, time })
    await w.deleteBranch('execute/data/sets', 'data/sets')
    assert.equal(await head('execute/data/sets'), undefined)
    assert.equal(await text('/data/sets/b.md'), 'b')
    await assert.rejects(w.deleteBranch('main', 'execute/main'), /permanent: main/)
    await assert.rejects(w.deleteBranch('nope', 'main'), /no branch: nope/)
  })

  test(`${name}: commitTree: a checkpoint replacing the whole tree`, async () => {
    const before = await head('data/sets')
    const blob = await wb.writeBlob('only')
    const tree = await wb.writeTree([{ name: 'only.md', mode: '100644', type: 'blob', oid: blob }])
    const oid = await w.commitTree('data/sets', tree, 'Replace', { author, time })
    assert.deepEqual((await wb.readCommit(oid)).parents, [before])
    assert.deepEqual((await wrepo.select('/data/sets/*')).map(([p]) => p), ['/data/sets/only.md'])
    await assert.rejects(w.commitTree('nope', tree, 'x', { author, time }), /no branch: nope/)
  })

  test(`${name}: init: a new, empty, bare repository`, async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'init-')), 'new')
    const b = await makeBackend(dir)
    await b.init()
    assert.deepEqual(await b.listBranches(), [])
    const tree = await b.writeTree([])
    const c = await b.writeCommit({ tree, parents: [], message: 'First', author, time })
    await b.updateBranch('main', c, null)
    assert.deepEqual(await b.listBranches(), [['main', c]])
  })

  test(`${name}: raw objects: read, write, has`, async () => {
    const main = await head('main')
    const { type, object } = await wb.readObject(main)
    assert.equal(type, 'commit')
    assert.equal(await wb.writeObject(type, object), main)
    assert.ok(await wb.hasObject(main))
    assert.ok(!await wb.hasObject('0123456789012345678901234567890123456789'))
  })

  test(`${name}: importLayer: new under the layer rules, existing only forward`, async () => {
    const start = await head('data/sets')
    const c = await w.change('data/sets')
    await c.put('/c.md', 'c')
    const next = await c.commit('Put', { author, time })
    await assert.rejects(w.importLayer('data/copy', '0123456789012345678901234567890123456789'), /no commit/)
    assert.equal(await w.importLayer('data/copy', start), start)
    assert.equal(await w.importLayer('data/copy', start), start)
    assert.equal(await w.importLayer('data/copy', next), next)
    await assert.rejects(w.importLayer('data/copy', start), /diverged: data\/copy/)
    await assert.rejects(w.importLayer('other/x', start), /not a layer/)
    await assert.rejects(w.importLayer('data/copy/x', start), /not a leaf/)
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
