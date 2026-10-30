import Corestore from 'corestore'
import Hyperdrive from 'hyperdrive'
import { createFs } from '/home/user/dev-env-1-mycelium-git/mycelium-git/node_modules/p2p-git/hyperdrive-fs.js'
import { p2pgitBackend, nativeBackend, writer, openRepo } from '/home/user/dev-env-1-mycelium-git/mycelium-git/index.js'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const author = { name: 'a', email: 'a@b' }, time = '2026-01-02T00:00:00Z'
async function scenario (b) {
  const out = []
  const step = async (k, f) => { try { out.push([k, await f()]) } catch (e) { out.push([k, 'ERR ' + e.message.slice(0, 100)]) } }
  const w = writer(b)
  await step('init', async () => { await b.init(); return (await b.listBranches()).length })
  await step('main', () => w.createLayer('main', 'Create main', { author, time }))
  await step('put', async () => { const c = await w.change('main'); await c.put('/docs/a.md', 'a'); return c.commit('Put', { author, time }) })
  await step('exec', () => w.createExecution('main'))
  await step('put2', async () => { const c = await w.change('execute/main'); await c.put('/b.md', 'b'); return c.commit('Respond', { author, time }) })
  await step('put3', async () => { const c = await w.change('main'); await c.put('/c.md', 'c'); return c.commit('Other', { author, time }) })
  await step('merge', () => w.merge('execute/main', 'main', 'Merge', { author, time }))
  await step('read', async () => (await openRepo(b).read('/main/b.md')).toString())
  await step('select', async () => (await openRepo(b).select('/main/*')).map(([p]) => p).join(' '))
  await step('delete', async () => { await w.deleteBranch('execute/main', 'main'); return (await b.listBranches()).map(([n]) => n).join(' ') })
  return out
}
const native = await scenario(nativeBackend(join(mkdtempSync(join(tmpdir(), 'n-')), 'r')))
const store = new Corestore(mkdtempSync(join(tmpdir(), 'cs-')))
const drive = new Hyperdrive(store)
await drive.ready()
const t = Date.now()
const base = createFs(drive)
const dir = { isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false, mode: 0o40755, size: 0, uid: 1, gid: 1, ino: 0, dev: 0, mtimeMs: 0, ctimeMs: 0 }
const fixDir = f => async path => { const s = await f(path); return s.isDirectory() || s.isFile() || s.isSymbolicLink() ? s : dir }
const fs = { promises: { ...base.promises, stat: fixDir(base.promises.stat), lstat: fixDir(base.promises.lstat),
  async readlink (path) { const e = await drive.entry(path); if (!e || !e.value.linkname) { const err = new Error('ENOENT ' + path); err.code = 'ENOENT'; throw err } return e.value.linkname },
  async symlink (target, path) { await drive.symlink(path, target) } } }
const hyper = await scenario(p2pgitBackend('/', { fs }))
const ms = Date.now() - t
native.forEach(([k, v], i) => console.log(JSON.stringify(v) === JSON.stringify(hyper[i][1]) ? 'same' : 'DIFF', k, String(v).slice(0, 60), '|', String(hyper[i][1]).slice(0, 60)))
console.log('hyperdrive scenario', ms, 'ms; drive version', drive.version, 'core length', drive.core.length)
await drive.close(); await store.close()
