import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSegment, isUri, parse, format, join, parent, split } from '../index.js'

test('isSegment', () => {
  for (const s of ['main', 'a-1', '0', 'phase-1']) assert.ok(isSegment(s), s)
  for (const s of ['', 'Main', 'a_b', 'a.b', 'a b', 'é', null]) assert.ok(!isSegment(s), String(s))
})

test('parse', () => {
  assert.deepEqual(parse('/'), [])
  assert.deepEqual(parse('/main'), ['main'])
  assert.deepEqual(parse('/overlay/config/x-1'), ['overlay', 'config', 'x-1'])
  for (const bad of ['', 'main', '/main/', '//', '/a//b', '/A', '/a?b', '/a#b', 'git:/a', '/a.txt']) {
    assert.throws(() => parse(bad), undefined, bad)
  }
  assert.throws(() => parse(42), TypeError)
})

test('isUri', () => {
  assert.ok(isUri('/main/x'))
  assert.ok(!isUri('main/x'))
})

test('format', () => {
  assert.equal(format([]), '/')
  assert.equal(format(['main', 'x']), '/main/x')
  assert.throws(() => format(['main', 'X']))
})

test('join', () => {
  assert.equal(join('/', 'main'), '/main')
  assert.equal(join('/main', 'a/b', 'c'), '/main/a/b/c')
  assert.throws(() => join('/main', 'A'))
  for (const bad of ['', 'a//b', '/a', 'a/']) assert.throws(() => join('/main', bad), undefined, bad)
})

test('parent', () => {
  assert.equal(parent('/main/a'), '/main')
  assert.equal(parent('/main'), '/')
  assert.throws(() => parent('/'))
})

test('split', () => {
  const branches = ['main', 'pending/default', 'overlay/config', 'capability/test']
  assert.deepEqual(split('/main', branches), { branch: 'main', path: '/' })
  assert.deepEqual(split('/main/a/b', branches), { branch: 'main', path: '/a/b' })
  assert.deepEqual(split('/overlay/config/x', branches), { branch: 'overlay/config', path: '/x' })
  assert.deepEqual(split('/pending/default/pending/phase-1', branches),
    { branch: 'pending/default', path: '/pending/phase-1' })
  assert.throws(() => split('/overlay', branches), /no branch/)
  assert.throws(() => split('/other/x', branches), /no branch/)
  assert.throws(() => split('/a/b', ['a', 'a/b']), /overlap/)
  assert.deepEqual(split('/main/x', new Set(['main'])), { branch: 'main', path: '/x' })
  for (const bad of ['Feature_X', 'a//b', '/main', '']) {
    assert.throws(() => split('/main/x', ['main', bad]), /bad branch name/, bad)
  }
})
