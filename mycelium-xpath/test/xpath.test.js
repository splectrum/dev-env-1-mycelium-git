import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { select, objectChildren } from '../index.js'

const tree = JSON.parse(readFileSync(new URL('./tree.json', import.meta.url)))
const kids = objectChildren

test('select: plain steps', async () => {
  assert.deepEqual(await select(kids, tree, '/main/readme'), [['/main/readme', 'hello']])
  assert.deepEqual(await select(kids, tree, '/main/nope'), [])
  assert.deepEqual(await select(kids, tree, '/'), [['/', tree]])
  assert.deepEqual(await select(kids, tree, '/main/docs'), [['/main/docs', { a: 'A', b: 'B' }]])
  assert.deepEqual(await select(kids, tree, '/main/readme/deeper'), [])
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
  assert.deepEqual(await select(slow, tree, '/main/src/*/x'), [['/main/src/lib/x', 'X']])
})
