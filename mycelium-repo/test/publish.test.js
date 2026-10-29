import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fixture } from '../../mycelium-git/test/contract.js'
import { nativeBackend, p2pgitBackend, openRepo, writer } from '../../mycelium-git/index.js'
import { publish, receive } from '../index.js'

const author = { name: 'test', email: 'test@localhost' }
const time = '2026-01-02T00:00:00Z'
const empty = () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'product-')), 'repo')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', dir])
  return dir
}
const put = async (b, path, text) => {
  const c = await writer(b).change('main')
  await c.put(path, text)
  return c.commit(`Put ${path}`, { author, time })
}

test('publish, receive, then publish again: only forward', async () => {
  const repo = nativeBackend(fixture())
  const product = p2pgitBackend(empty())
  await put(repo, '/pkg/a.md', 'a')
  const first = await publish({ repo, pkg: 'pkg', product })
  assert.equal(Object.fromEntries(await repo.listBranches())['publish/pkg'], first.split)
  await receive({ product, message: 'Merge', author, time })
  assert.equal((await openRepo(product).read('/main/a.md')).toString(), 'a')

  await put(repo, '/other.md', 'not in the package')
  await put(repo, '/pkg/b.md', 'b')
  const second = await publish({ repo, pkg: 'pkg', product })
  assert.notEqual(second.split, first.split)
  assert.equal(second.copied, 3)
  await receive({ product, message: 'Merge', author, time })
  const files = (await openRepo(product).select('/main/*')).map(([p]) => p)
  assert.deepEqual(files, ['/main/a.md', '/main/b.md'])

  await assert.rejects(publish({ repo, pkg: 'nope', product }), /no folder: nope/)
})
