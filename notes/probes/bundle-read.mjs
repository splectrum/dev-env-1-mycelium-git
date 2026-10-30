// Read a native bundle into loose objects with p2p-git's own pieces.
import nodeFs from 'node:fs'
import { FileSystem } from '/home/user/ref/bare-for-pear_p2p-git/src/models/FileSystem.js'
import { listpack } from '/home/user/ref/bare-for-pear_p2p-git/src/utils/git-list-pack.js'
import { applyDelta } from '/home/user/ref/bare-for-pear_p2p-git/src/utils/applyDelta.js'
import * as git from '/home/user/ref/bare-for-pear_p2p-git/src/plumbing.js'
const [file, gitdir] = process.argv.slice(2)
const buf = nodeFs.readFileSync(file)
const split = buf.indexOf('\n\n') + 2
const refs = buf.slice(0, split).toString().split('\n').slice(1).filter(l => /^[0-9a-f]{40} /.test(l)).map(l => l.split(' '))
// git's offset encoding: big-endian 7-bit groups, plus one per continuation.
function gitOfs (bytes) {
  let i = 0, b = bytes[i++], n = b & 0x7f
  while (b & 0x80) { b = bytes[i++]; n = ((n + 1) << 7) | (b & 0x7f) }
  return n
}
const names = { 1: 'commit', 2: 'tree', 3: 'blob', 4: 'tag' }
const byOffset = new Map(), byOid = new Map(), deltas = []
let kinds = {}
await listpack([buf.slice(split)], async ({ data, type, offset, reference, ofs }) => {
  kinds[type] = (kinds[type] || 0) + 1
  if (type === 6 || type === 7) deltas.push({ data: Buffer.from(data), type, offset, base: type === 6 ? offset - gitOfs(reference) : Buffer.from(reference).toString('hex') })
  else byOffset.set(offset, { type: names[type], data: Buffer.from(data) })
})
const fs = { ...nodeFs }
for (const o of byOffset.values()) byOid.set(await git.writeObject({ fs: nodeFs, gitdir, type: o.type, object: o.data, format: 'content' }), o)
let left = deltas
while (left.length) {
  const next = []
  for (const d of left) {
    const base = d.type === 6 ? byOffset.get(d.base) : byOid.get(d.base)
    if (!base) { next.push(d); continue }
    const o = { type: base.type, data: Buffer.from(applyDelta(d.data, base.data)) }
    byOffset.set(d.offset, o)
    byOid.set(await git.writeObject({ fs: nodeFs, gitdir, type: o.type, object: o.data, format: 'content' }), o)
  }
  if (next.length === left.length) throw new Error('unresolvable deltas')
  left = next
}
for (const [oid, ref] of refs) if (ref.startsWith('refs/heads/')) await git.writeRef({ fs: nodeFs, gitdir, ref, value: oid, force: true })
console.log(JSON.stringify({ kinds, objects: byOid.size, refs: refs.length }))
