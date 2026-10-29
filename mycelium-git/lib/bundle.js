// Bundles: a repository's branches packed into one file, on the backend
// contract, so on every engine. A bundle is git's format: a header naming
// the refs, then a packfile of every object they reach. Ours are full
// (no prerequisites): self-contained, readable with nothing else around.
// Writing stores each object whole (no deltas); reading also takes the
// delta-compressed objects native git's bundles hold, and writes every
// object as a loose object.

import { createHash } from 'node:crypto'
import pako from 'pako'

const TYPES = { commit: 1, tree: 2, blob: 3, tag: 4 }
const NAMES = { 1: 'commit', 2: 'tree', 3: 'blob', 4: 'tag' }

// A bundle of the given branches ({ name: commit }), as bytes.
export async function writeBundle (backend, branches) {
  const oids = await reachable(backend, Object.values(branches))
  const parts = [Buffer.from('PACK'), u32(2), u32(oids.length)]
  for (const oid of oids) {
    const { type, object } = await backend.readObject(oid)
    parts.push(entryHeader(TYPES[type], object.length), Buffer.from(pako.deflate(object)))
  }
  const pack = Buffer.concat(parts)
  const header = '# v2 git bundle\n' +
    Object.entries(branches).map(([name, oid]) => `${oid} refs/heads/${name}\n`).join('') + '\n'
  return Buffer.concat([Buffer.from(header), pack, createHash('sha1').update(pack).digest()])
}

// Read a bundle's objects into a backend. Resolves { branches, objects }.
// A bundle with prerequisites the backend lacks is refused.
export async function readBundle (backend, bytes) {
  const end = bytes.indexOf('\n\n')
  const lines = bytes.subarray(0, end).toString().split('\n')
  if (lines[0] !== '# v2 git bundle') throw new Error('not a v2 git bundle')
  const branches = {}
  for (const line of lines.slice(1)) {
    if (line.startsWith('-')) {
      const oid = line.slice(1, 41)
      if (!await backend.hasObject(oid)) throw new Error(`prerequisite missing: ${oid}`)
    } else {
      const [oid, ref] = line.split(' ')
      if (ref.startsWith('refs/heads/')) branches[ref.slice(11)] = oid
    }
  }
  const pack = bytes.subarray(end + 2)
  const body = pack.subarray(0, pack.length - 20)
  if (!createHash('sha1').update(body).digest().equals(pack.subarray(pack.length - 20))) {
    throw new Error('bundle checksum does not match')
  }
  return { branches, objects: await unpack(backend, body) }
}

// Every object the commits reach.
async function reachable (backend, commits) {
  const seen = new Set()
  const todo = [...commits]
  while (todo.length) {
    const oid = todo.pop()
    if (seen.has(oid)) continue
    seen.add(oid)
    const { type } = await backend.readObject(oid)
    if (type === 'commit') {
      const c = await backend.readCommit(oid)
      todo.push(c.tree, ...c.parents)
    } else if (type === 'tree') {
      for (const e of await backend.readTree(oid)) if (e.type !== 'commit') todo.push(e.oid)
    }
  }
  return [...seen]
}

// Unpack a packfile into loose objects; resolve deltas against objects in
// the pack (by offset or oid) or already in the backend (by oid).
async function unpack (backend, pack) {
  if (pack.subarray(0, 4).toString() !== 'PACK') throw new Error('not a packfile')
  const count = pack.readUInt32BE(8)
  const byOffset = new Map()
  const byOid = new Map()
  const deltas = []
  let pos = 12
  for (let i = 0; i < count; i++) {
    const start = pos
    let c = pack[pos++]
    const type = (c >> 4) & 7
    while (c & 0x80) c = pack[pos++]
    let base
    if (type === 6) {
      c = pack[pos++]
      let n = c & 0x7f
      while (c & 0x80) { c = pack[pos++]; n = ((n + 1) * 128) + (c & 0x7f) }
      base = { offset: start - n }
    } else if (type === 7) {
      base = { oid: pack.subarray(pos, pos + 20).toString('hex') }
      pos += 20
    }
    const inflator = new pako.Inflate()
    inflator.push(pack.subarray(pos), true)
    if (inflator.err) throw new Error(`inflate: ${inflator.msg}`)
    pos += inflator.strm.next_in
    const data = Buffer.from(inflator.result)
    if (base) deltas.push({ start, base, data })
    else byOffset.set(start, { type: NAMES[type], data })
  }
  const store = async (start, object) => {
    byOffset.set(start, object)
    byOid.set(await backend.writeObject(object.type, object.data), object)
  }
  for (const [start, object] of [...byOffset]) await store(start, object)
  let left = deltas
  while (left.length) {
    const next = []
    for (const d of left) {
      let base = d.base.offset !== undefined ? byOffset.get(d.base.offset) : byOid.get(d.base.oid)
      if (!base && d.base.oid && await backend.hasObject(d.base.oid)) {
        const { type, object } = await backend.readObject(d.base.oid)
        base = { type, data: object }
      }
      if (!base) { next.push(d); continue }
      await store(d.start, { type: base.type, data: applyDelta(base.data, d.data) })
    }
    if (next.length === left.length) throw new Error('unresolvable deltas in bundle')
    left = next
  }
  return byOid.size
}

// git's delta format: source and target sizes, then copy and insert ops.
function applyDelta (base, delta) {
  let p = 0
  const size = () => {
    let n = 0
    let shift = 0
    let c
    do { c = delta[p++]; n += (c & 0x7f) * 2 ** shift; shift += 7 } while (c & 0x80)
    return n
  }
  size()
  const out = Buffer.alloc(size())
  let o = 0
  while (p < delta.length) {
    const op = delta[p++]
    if (op & 0x80) {
      let off = 0
      let len = 0
      for (let i = 0; i < 4; i++) if (op & (1 << i)) off += delta[p++] * 2 ** (8 * i)
      for (let i = 0; i < 3; i++) if (op & (0x10 << i)) len += delta[p++] * 2 ** (8 * i)
      if (len === 0) len = 0x10000
      base.copy(out, o, off, off + len)
      o += len
    } else {
      delta.copy(out, o, p, p + op)
      o += op
      p += op
    }
  }
  if (o !== out.length) throw new Error('delta does not match its size')
  return out
}

function u32 (n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n)
  return b
}

// A pack entry's header: type and size, size in 7-bit groups, low first.
function entryHeader (type, size) {
  const bytes = [(type << 4) | (size & 15)]
  size = Math.floor(size / 16)
  while (size > 0) {
    bytes[bytes.length - 1] |= 0x80
    bytes.push(size & 0x7f)
    size = Math.floor(size / 128)
  }
  return Buffer.from(bytes)
}
