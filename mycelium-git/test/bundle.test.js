// Bundles against native git: ours verify and clone with native git, and
// native bundles (with delta-compressed objects) read into every engine.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fixture } from './contract.js'
import { nativeBackend, isogitBackend, p2pgitBackend, writeBundle, readBundle, openRepo } from '../index.js'

const engines = { native: nativeBackend, isogit: isogitBackend, p2pgit: p2pgitBackend }
const tmp = name => join(mkdtempSync(join(tmpdir(), 'bundle-')), name)
const git = (...args) => execFileSync('git', args).toString().trim()

test('writeBundle: native git verifies, clones and fscks it, on every engine', async () => {
  for (const [name, make] of Object.entries(engines)) {
    const backend = make(fixture())
    const branches = Object.fromEntries(await backend.listBranches())
    const file = tmp('all.bundle')
    writeFileSync(file, await writeBundle(backend, branches))
    const clone = tmp('clone')
    git('clone', '-q', '--bare', file, clone)
    git('-C', clone, 'bundle', 'verify', '-q', file)
    git('-C', clone, 'fsck', '--full', '--no-dangling')
    const cloned = Object.fromEntries(git('-C', clone, 'for-each-ref', '--format=%(refname:strip=2) %(objectname)', 'refs/heads')
      .split('\n').map(l => l.split(' ')))
    assert.deepEqual(cloned, branches, name)
  }
})

test('readBundle: a native bundle with deltas, into every engine', async () => {
  const src = tmp('src')
  git('init', '-q', '-b', 'main', src)
  const big = Array.from({ length: 3000 }, (_, i) => `line ${i} ${'x'.repeat(i % 40)}`)
  for (const [i, change] of [[5, 'one'], [9, 'two'], [2000, 'three']]) {
    big[i] = change
    writeFileSync(join(src, 'big.txt'), big.join('\n'))
    git('-C', src, 'add', '.')
    git('-C', src, '-c', 'user.name=a', '-c', 'user.email=a@b', 'commit', '-q', '-m', change)
  }
  const file = tmp('native.bundle')
  git('-C', src, 'bundle', 'create', '-q', file, '--all')
  const head = git('-C', src, 'rev-parse', 'main')
  for (const [name, make] of Object.entries(engines)) {
    const dir = tmp('to')
    const backend = make(dir)
    await backend.init()
    const { branches, objects } = await readBundle(backend, execFileSync('cat', [file]))
    assert.deepEqual(branches, { main: head }, name)
    assert.equal(objects, 9, name)
    await backend.updateBranch('main', head, null)
    const text = (await openRepo(backend).read('/main/big.txt')).toString()
    assert.equal(text, big.join('\n'), name)
    for (const [i, change] of [[1, 'one'], [2, 'two']]) {
      const old = git('-C', src, 'show', `main~${3 - i}:big.txt`)
      assert.ok(old.includes(change), name)
    }
    git('-C', dir, 'fsck', '--full', '--no-dangling')
  }
})

test('readBundle: a corrupted bundle and missing prerequisites are refused', async () => {
  const backend = nativeBackend(fixture())
  const bytes = await writeBundle(backend, Object.fromEntries(await backend.listBranches()))
  const corrupt = Buffer.from(bytes)
  corrupt[corrupt.length - 30] ^= 1
  const target = nativeBackend(tmp('to'))
  await target.init()
  await assert.rejects(readBundle(target, corrupt), /checksum/)
  const end = bytes.indexOf('\n\n')
  const prereq = Buffer.concat([Buffer.from('# v2 git bundle\n-0123456789012345678901234567890123456789 x\n'),
    bytes.subarray(bytes.indexOf('\n') + 1, end), bytes.subarray(end)])
  await assert.rejects(readBundle(target, prereq), /prerequisite missing/)
})
