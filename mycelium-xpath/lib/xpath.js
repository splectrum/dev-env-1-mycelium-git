// Navigate a tree by path. Generic: the tree is reached only through
// children(node), which returns the node's children as [name, child] pairs,
// or null for a leaf. It may be async (a git tree is read from storage).
//
// Paths are '/'-separated from the root, and valid: they are validated at
// the boundary, not here. A '*' step matches every child. Names match
// exactly; match(name, step) replaces that, for the boundary, which finds
// stored names from an external URI once (see mycelium-uri sameName).

// All nodes matching a path, as [path, node] pairs, in the order children()
// gives them. A plain path gives zero or one pair.
export async function select (children, root, path, match = exact) {
  let found = [['', root]]
  for (const name of steps(path)) {
    const next = []
    for (const [at, node] of found) {
      for (const [n, child] of (await children(node)) || []) {
        if (name === '*' || match(n, name)) next.push([at + '/' + n, child])
      }
    }
    found = next
  }
  return found.map(([at, node]) => [at || '/', node])
}

function exact (name, step) {
  return name === step
}

function steps (path) {
  return path.split('/').filter(Boolean)
}

// children() for plain objects: an object is a folder, anything else a leaf.
export function objectChildren (node) {
  return node !== null && typeof node === 'object' && !Array.isArray(node)
    ? Object.entries(node)
    : null
}
