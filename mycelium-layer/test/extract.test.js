import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { fixture } from '../../mycelium-git/test/contract.js'
import { nativeBackend, isogitBackend, p2pgitBackend } from '../../mycelium-git/index.js'
import { deploy, extract } from '../index.js'

const folder = fileURLToPath(new URL('./folder', import.meta.url))
const author = { name: 'test', email: 'test@localhost' }
const time = '2026-01-02T00:00:00Z'

test('extract: files and modes back, provenance beside, a round trip to the same tree', async () => {
  for (const make of [nativeBackend, isogitBackend, p2pgitBackend]) {
    const backend = make(fixture())
    const { tree, commit } = await deploy({ backend, layer: 'capability/test', folder, message: 'Deploy', author, time })
    const out = join(fs.mkdtempSync(join(tmpdir(), 'extract-')), 'pkg')
    const p = await extract({ backend, layer: 'capability/test', folder: out, source: 'fixture' })
    assert.deepEqual(p, { source: 'fixture', layer: 'capability/test', path: '/', commit, tree, files: 4 })
    assert.deepEqual(JSON.parse(fs.readFileSync(`${out}.provenance.json`)), p)
    assert.equal(fs.readFileSync(join(out, 'sub/b.md'), 'utf8'), 'b\n')
    assert.equal(fs.readlinkSync(join(out, 'link.md')), 'sub/b.md')
    assert.ok(fs.statSync(join(out, 'run.sh')).mode & 0o100)
    assert.ok(!(fs.statSync(join(out, 'a.md')).mode & 0o100))
    const again = await deploy({ backend, layer: 'capability/again', folder: out, message: 'Again', author, time })
    assert.equal(again.tree, tree)

    const sub = await extract({ backend, layer: 'capability/test', path: '/sub', folder: out + '-sub' })
    assert.equal(sub.files, 1)
    await assert.rejects(extract({ backend, layer: 'capability/test', folder: out }), /exists/)
    await assert.rejects(extract({ backend, layer: 'capability/test', path: '/a.md', folder: out + '-x' }), /not a folder/)
    await assert.rejects(extract({ backend, layer: 'nope', folder: out + '-y' }), /no branch: nope/)
  }
})
