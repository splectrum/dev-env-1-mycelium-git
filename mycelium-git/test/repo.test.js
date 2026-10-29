import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { nativeBackend, openRepo } from '../index.js'
import { sameName } from '../../mycelium-uri/index.js'

let repo
before(() => {
  const dir = join(mkdtempSync(join(tmpdir(), 'mycelium-git-')), 'repo')
  execFileSync('sh', [new URL('./fixture.sh', import.meta.url).pathname, dir])
  repo = openRepo(nativeBackend(dir))
})

const paths = found => found.map(([p]) => p)

test('above the branches: name segments', async () => {
  assert.deepEqual(paths(await repo.select('/*')), ['/main', '/overlay', '/pending'])
  assert.deepEqual(paths(await repo.select('/pending/*')), ['/pending/default'])
  assert.deepEqual(paths(await repo.select('/*/*')),
    ['/main/README.md', '/main/docs', '/main/readme', '/overlay/config', '/pending/default'])
})

test('into a branch', async () => {
  assert.deepEqual(paths(await repo.select('/main/*')), ['/main/README.md', '/main/docs', '/main/readme'])
  assert.deepEqual(paths(await repo.select('/pending/default/pending/*')), ['/pending/default/pending/r1'])
  assert.deepEqual(paths(await repo.select('/*/docs/a')), ['/main/docs/a'])
  assert.deepEqual(paths(await repo.select('/*/*/docs/a')), ['/overlay/config/docs/a'])
  assert.deepEqual(await repo.select('/main/nope'), [])
})

test('read', async () => {
  assert.equal((await repo.read('/main/readme')).toString(), 'hello')
  assert.equal((await repo.read('/overlay/config/docs/a')).toString(), 'conf')
  assert.equal((await repo.read('/main/README.md')).toString(), 'convention')
  await assert.rejects(repo.read('/main/readme.md'), /not a file/)
  assert.equal((await repo.read('/main/readme.md', sameName)).toString(), 'convention')
  await assert.rejects(repo.read('/main/docs'), /not a file/)
  await assert.rejects(repo.read('/main/nope'), /not a file/)
})
