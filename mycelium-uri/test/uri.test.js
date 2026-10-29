import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSegment, validate, isUri, parse, format, join, parent, split } from '../index.js'

test('isSegment', () => {
  for (const s of ['main', 'a-1', '0', 'phase-1', 'request.md', 'a.tar.gz']) assert.ok(isSegment(s), s)
  for (const s of ['', 'Main', 'a_b', 'a b', 'é', '.gitignore', 'a.', 'a..b', '.', '..', 'README.md', null]) {
    assert.ok(!isSegment(s), String(s))
  }
})

test('validate: canonical URIs pass unchanged', () => {
  for (const u of ['/', '/main', '/overlay/config/x-1']) assert.equal(validate(u), u)
})

test('validate: accepted deviations are fixed', () => {
  assert.equal(validate(''), '/')
  assert.equal(validate('//'), '/')
  assert.equal(validate('/main/'), '/main')
  assert.equal(validate('/main//x/'), '/main/x')
  assert.equal(validate('///a///b///'), '/a/b')
})

test('validate: broken rules throw', () => {
  assert.equal(validate('/pending/default/pending/r1/request.md'), '/pending/default/pending/r1/request.md')
  for (const bad of ['main', 'main/x', '/A', '/a?b', '/a#b', 'git:/a', '/a b', '/é', '/.git', '/a/..', '/a.']) {
    assert.throws(() => validate(bad), undefined, bad)
  }
  assert.throws(() => validate(42), TypeError)
})

test('validate: star steps', () => {
  assert.equal(validate('/main/*/a//', { star: true }), '/main/*/a')
  assert.throws(() => validate('/main/*'), /bad segment '\*'/)
  assert.throws(() => validate('/main/*x', { star: true }), /bad segment '\*x'/)
})

test('isUri: canonical only', () => {
  assert.ok(isUri('/main/x'))
  assert.ok(!isUri('/main/'))
  assert.ok(!isUri('main/x'))
})

test('parse', () => {
  assert.deepEqual(parse('/'), [])
  assert.deepEqual(parse('/main'), ['main'])
  assert.deepEqual(parse('/overlay/config/x-1'), ['overlay', 'config', 'x-1'])
  assert.throws(() => parse('/main/'), /not canonical: \/main\/ \(canonical: \/main\)/)
  assert.throws(() => parse('main'), /not absolute/)
})

test('format', () => {
  assert.equal(format([]), '/')
  assert.equal(format(['main', 'x']), '/main/x')
})

test('join', () => {
  assert.equal(join('/', 'main'), '/main')
  assert.equal(join('/main', 'a/b', 'c'), '/main/a/b/c')
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
})
