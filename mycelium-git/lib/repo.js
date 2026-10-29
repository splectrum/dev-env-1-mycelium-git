// A repository as one tree, for mycelium-xpath. Every path starts with a
// branch name, from the root: /main/x, /pending/default/pending/r1. Above
// the branches the tree is made of their name segments; a full branch name
// is its commit's tree. A name is never both a branch and a prefix, so this
// is unambiguous.
//
// Nodes: { type: 'branches', prefix } above the branches,
//        { type: 'tree', oid }, { type: 'blob', oid } below.

import { select as xselect } from '../../mycelium-xpath/index.js'

export function openRepo (backend) {
  async function children (node) {
    if (node.type === 'blob') return null
    if (node.type === 'tree') {
      return (await backend.readTree(node.oid))
        .filter(e => e.type === 'tree' || e.type === 'blob')
        .map(e => [e.name, { type: e.type, oid: e.oid }])
    }
    // Above the branches: the next name segment of every branch under prefix.
    const next = new Map()
    for (const [name, commit] of await backend.listBranches()) {
      if (!name.startsWith(node.prefix)) continue
      const [segment, ...rest] = name.slice(node.prefix.length).split('/')
      if (next.has(segment)) continue
      next.set(segment, rest.length
        ? { type: 'branches', prefix: node.prefix + segment + '/' }
        : { type: 'tree', oid: (await backend.readCommit(commit)).tree })
    }
    return [...next]
  }

  const root = { type: 'branches', prefix: '' }

  return {
    // All nodes matching a path, as [path, node] pairs ('*' steps allowed).
    select: path => xselect(children, root, path),

    // The content of the one blob at a path.
    async read (path) {
      const found = await xselect(children, root, path)
      if (found.length !== 1 || found[0][1].type !== 'blob') throw new Error(`not a file: ${path}`)
      return backend.readBlob(found[0][1].oid)
    }
  }
}
