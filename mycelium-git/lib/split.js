// Splitting a folder out of a branch's history, as git subtree split does,
// on the backend contract, so on every engine: each commit whose folder
// changed becomes a commit of the folder alone, with the original author,
// committer and message. The same history gives the same split commits as
// native git subtree split (no --rejoin, no annotation).

// The split of folder (a path, e.g. 'mycelium-uri') from the history of
// commit head. Resolves the split's head commit, or null if the folder never
// existed. Writes the split commits into the backend.
export async function split (backend, head, folder) {
  const map = new Map()
  const treeOf = async c => (await backend.readCommit(c)).tree
  for (const { oid, parents } of await oldestFirst(backend, head)) {
    const mapped = parents.filter(p => map.has(p)).map(p => map.get(p))
    const tree = await subtree(backend, await treeOf(oid), folder)
    if (!tree) {
      // As git subtree: a commit without the folder after one with it maps
      // to itself.
      if (mapped.length) map.set(oid, oid)
      continue
    }
    map.set(oid, await copyOrSkip(backend, treeOf, oid, tree, mapped))
  }
  return map.get(head) || null
}

// git subtree's copy_or_skip: reuse a mapped parent whose tree is the same,
// unless another parent brings commits it lacks; otherwise copy the commit.
async function copyOrSkip (backend, treeOf, oid, tree, mapped) {
  let identical = null
  let nonidentical = null
  let copy = false
  const parents = []
  for (const parent of mapped) {
    if (await treeOf(parent) === tree) {
      if (identical) {
        const base = await backend.mergeBase(identical, parent)
        if (identical === base) identical = parent
        else if (parent !== base) copy = true
      } else {
        identical = parent
      }
    } else {
      nonidentical = parent
    }
    if (!parents.includes(parent)) parents.push(parent)
  }
  if (identical && nonidentical && !await backend.isAncestor(nonidentical, identical)) copy = true
  if (identical && !copy) return identical
  return copyCommit(backend, oid, tree, parents)
}

// The commit again, with another tree and parents: its author, committer
// and message kept as they are; other headers (encoding, signatures) dropped.
async function copyCommit (backend, oid, tree, parents) {
  const raw = (await backend.readObject(oid)).object
  const end = raw.indexOf('\n\n')
  const headers = raw.subarray(0, end).toString('utf8').split('\n')
  const keep = headers.filter(h => h.startsWith('author ') || h.startsWith('committer '))
  const head = [`tree ${tree}`, ...parents.map(p => `parent ${p}`), ...keep].join('\n')
  return backend.writeObject('commit', Buffer.concat([Buffer.from(head), raw.subarray(end)]))
}

// The tree at a folder path in a tree, or null.
async function subtree (backend, tree, folder) {
  for (const name of folder.split('/').filter(Boolean)) {
    const entry = (await backend.readTree(tree)).find(e => e.name === name)
    if (!entry || entry.type !== 'tree') return null
    tree = entry.oid
  }
  return tree
}

// Every commit head reaches, parents before children, with their parents.
async function oldestFirst (backend, head) {
  const seen = new Set()
  const out = []
  const stack = [[head, null]]
  while (stack.length) {
    const [oid, parents] = stack.pop()
    if (parents) { out.push({ oid, parents }); continue }
    if (seen.has(oid)) continue
    seen.add(oid)
    const ps = (await backend.readCommit(oid)).parents
    stack.push([oid, ps])
    for (const p of [...ps].reverse()) if (!seen.has(p)) stack.push([p, null])
  }
  return out
}
