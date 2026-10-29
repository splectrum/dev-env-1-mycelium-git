import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, select, objectChildren } from '../index.js'

const tree = JSON.parse(readFileSync(new URL('./tree.json', import.meta.url)))
const kids = objectChildren

test('resolve', async () => {
  assert.equal(await resolve(kids, tree, '/'), tree)
  assert.equal(await resolve(kids, tree, '/main/readme'), 'hello')
  assert.deepEqual(await resolve(kids, tree, '/main/docs'), { a: 'A', b: 'B' })
  assert.equal(await resolve(kids, tree, '/main/nope'), undefined)
  assert.equal(await resolve(kids, tree, '/main/readme/deeper'), undefined)
})

test('select: plain steps', async () => {
  assert.deepEqual(await select(kids, tree, '/main/readme'), [['/main/readme', 'hello']])
  assert.deepEqual(await select(kids, tree, '/main/nope'), [])
  assert.deepEqual(await select(kids, tree, '/'), [['/', tree]])
})

test('select: * steps', async () => {
  assert.deepEqual((await select(kids, tree, '/main/*')).map(([p]) => p),
    ['/main/readme', '/main/docs', '/main/src'])
  assert.deepEqual(await select(kids, tree, '/main/*/a'),
    [['/main/docs/a', 'A'], ['/main/src/a', 'srcA']])
  assert.deepEqual(await select(kids, tree, '/*/*/docs/a'), [['/overlay/config/docs/a', 'conf']])
  assert.deepEqual(await select(kids, tree, '/empty/*'), [])
  assert.deepEqual(await select(kids, tree, '/main/readme/*'), [])
})

test('async children', async () => {
  const slow = async node => kids(node)
  assert.equal(await resolve(slow, tree, '/main/src/lib/x'), 'X')
  assert.deepEqual(await select(slow, tree, '/main/src/*/x'), [['/main/src/lib/x', 'X']])
})
