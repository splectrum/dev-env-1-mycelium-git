import * as p2p from '/home/user/ref/bare-for-pear_p2p-git/src/plumbing.js'
import { isoStyleBackend } from '/home/user/dev-env-1-mycelium-git/mycelium-git/lib/isogit.js'
import { nativeBackend, writer } from '/home/user/dev-env-1-mycelium-git/mycelium-git/index.js'
import { execFileSync } from 'node:child_process'
const author = { name: 'a', email: 'a@b' }, time = '2026-01-02T00:00:00Z'
async function scenario (make, dir) {
  execFileSync('sh', ['/home/user/dev-env-1-mycelium-git/mycelium-git/test/fixture.sh', dir])
  const b = make(dir), w = writer(b), out = []
  const step = async (k, f) => { try { out.push([k, await f()]) } catch (e) { out.push([k, 'ERR ' + e.message.slice(0, 90)]) } }
  await step('list', async () => (await b.listBranches()).length)
  await step('put', async () => { const c = await w.change('execute/main'); await c.put('/responses/r1.md', 'done'); return c.commit('Respond', { author, time }) })
  await step('put2', async () => { const c = await w.change('main'); await c.put('/other.md', 'o'); return c.commit('Other', { author, time }) })
  await step('merge', () => w.merge('execute/main', 'main', 'Merge', { author, time }))
  await step('ff', () => w.merge('main', 'execute/main', 'Sync', { author, time, fastForward: true }))
  await step('disjoint', () => w.merge('overlay/config', 'main', 'm', { author, time }))
  return out
}
const n = await scenario(nativeBackend, '/tmp/claude-0/p2/n')
const p = await scenario(d => isoStyleBackend(p2p, d), '/tmp/claude-0/p2/p')
n.forEach(([k, v], i) => console.log(JSON.stringify(v) === JSON.stringify(p[i][1]) ? 'same' : 'DIFF', k, v, '|', p[i][1]))
