import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { fixture } from '../../mycelium-git/test/contract.js'
import { nativeBackend, isogitBackend, p2pgitBackend, openRepo } from '../../mycelium-git/index.js'
import { deploy } from '../index.js'

const folder = fileURLToPath(new URL('./folder', import.meta.url))
const author = { name: 'test', email: 'test@localhost' }
const time = '2026-01-02T00:00:00Z'

test('deploy: the same tree on every engine, modes kept, empty folders left out', async () => {
  const trees = []
  for (const make of [nativeBackend, isogitBackend, p2pgitBackend]) {
    const backend = make(fixture())
    const first = await deploy({ backend, layer: 'capability/test', folder, message: 'Deploy', author, time })
    assert.equal(first.files, 4)
    trees.push(first.tree)
    const modes = Object.fromEntries((await backend.readTree(first.tree)).map(e => [e.name, e.mode]))
    assert.deepEqual(modes, { 'a.md': '100644', 'link.md': '120000', 'run.sh': '100755', sub: '040000' })
    assert.equal((await openRepo(backend).read('/capability/test/link.md')).toString(), 'sub/b.md')
    // A second deploy is a second commit on the layer.
    const second = await deploy({ backend, layer: 'capability/test', folder, message: 'Again', author, time })
    assert.deepEqual((await backend.readCommit(second.commit)).parents, [first.commit])
  }
  assert.equal(new Set(trees).size, 1)
})
