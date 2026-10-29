// Compatibility: the same writes give the same objects on every engine, so
// a repository written by one is the same repository for the other.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './contract.js'
import { isogitBackend, nativeBackend, p2pgitBackend, writer } from '../index.js'

const author = { name: 'a', email: 'a@b' }
const time = '2026-01-02T00:00:00Z'

// A run of writes; returns the oids and the errors, in order.
async function scenario (make) {
  const b = make(fixture())
  const w = writer(b)
  const out = []
  const head = async n => Object.fromEntries(await b.listBranches())[n]
  const put = async (branch, path, text) => {
    const c = await w.change(branch)
    await c.put(path, text)
    return c.commit(`Put ${path}`, { author, time })
  }
  const error = async f => { try { await f() } catch (err) { return err.message } }

  out.push(await put('execute/main', '/responses/r1.md', 'done'))
  out.push(await put('main', '/other.md', 'o'))
  out.push(await w.merge('execute/main', 'main', 'Merge', { author, time }))
  out.push(await w.merge('main', 'execute/main', 'Sync', { author, time, fastForward: true }))

  await b.updateBranch('side', await head('main'), null)
  await put('main', '/readme', 'main says')
  await put('side', '/readme', 'side says')
  out.push(await error(() => w.merge('side', 'main', 'm', { author, time })))
  out.push(await error(() => w.merge('overlay/config', 'main', 'm', { author, time })))

  out.push(await w.createLayer('data/sets', 'Create data/sets', { author, time }))
  out.push(await w.createExecution('data/sets'))
  await put('execute/data/sets', '/a.md', 'a')
  out.push(await w.merge('execute/data/sets', 'data/sets', 'Merge', { author, time }))
  await w.deleteBranch('execute/data/sets', 'data/sets')
  out.push(JSON.stringify(await b.listBranches()))

  const stale = await w.change('main')
  await stale.put('/b', 'b')
  await put('main', '/a', 'a')
  out.push((await error(() => stale.commit('b', { author, time }))).split(':')[0])
  return out
}

test('native, isomorphic-git and p2p-git: same writes, same oids and outcomes', async () => {
  const native = await scenario(nativeBackend)
  assert.equal(native.length, 11)
  assert.deepEqual(await scenario(isogitBackend), native)
  assert.deepEqual(await scenario(p2pgitBackend), native)
})
