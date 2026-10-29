// Writing under the rules: a change is a set of puts and removes on one
// branch, committed as one checkpoint; a merge is a plain merge. Refs move
// only by compare-and-swap, so history only grows and a concurrent change
// fails instead of being overwritten.
//
// Paths are inside the branch ('/responses/r1/response.md'), stored names,
// valid: they are validated at the boundary, not here.

const BLOB = '100644'
const TREE = '040000'

export function writer (backend) {
  const head = async branch => Object.fromEntries(await backend.listBranches())[branch]

  return {
    // Start a change on a branch. put(path, bytes) and remove(path) collect;
    // commit(message, { author, time }) writes it as one commit.
    async change (branch) {
      const start = await head(branch)
      if (!start) throw new Error(`no branch: ${branch}`)
      const base = (await backend.readCommit(start)).tree
      const edits = []
      return {
        async put (path, bytes) { edits.push([steps(path), await backend.writeBlob(bytes)]) },
        remove (path) { edits.push([steps(path), null]) },
        async commit (message, { author, time } = {}) {
          const tree = await apply(backend, base, edits, '')
          const oid = await backend.writeCommit({ tree, parents: [start], message, author, time })
          await backend.updateBranch(branch, oid, start)
          return oid
        }
      }
    },

    // Plain merge of branch from into branch into, as a merge commit. Nothing
    // to do if into already holds from. With fastForward, into simply moves
    // to from when it can (for syncing an execution branch; never for main).
    async merge (from, into, message, { author, time, fastForward = false } = {}) {
      const f = await head(from)
      const i = await head(into)
      if (!f || !i) throw new Error(`no branch: ${!f ? from : into}`)
      // Layers are disjoint: never merged into each other.
      if (!await backend.mergeBase(f, i)) throw new Error(`not merged: ${from} and ${into} are disjoint layers`)
      if (await backend.isAncestor(f, i)) return i
      if (fastForward && await backend.isAncestor(i, f)) {
        await backend.updateBranch(into, f, i)
        return f
      }
      const { tree, conflicts } = await backend.mergeTrees(i, f)
      if (conflicts.length) throw new Error(`merge conflicts: ${conflicts.join(', ')}`)
      const oid = await backend.writeCommit({ tree, parents: [i, f], message, author, time })
      await backend.updateBranch(into, oid, i)
      return oid
    }
  }
}

// A new tree: treeOid (or empty) with the edits applied. Folders left empty
// disappear, as in git.
async function apply (backend, treeOid, edits, at) {
  const entries = new Map((treeOid ? await backend.readTree(treeOid) : []).map(e => [e.name, e]))
  const groups = new Map()
  for (const [[name, ...rest], value] of edits) {
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push([rest, value])
  }
  for (const [name, group] of groups) {
    const path = `${at}/${name}`
    const here = group.filter(([rest]) => rest.length === 0)
    const below = group.filter(([rest]) => rest.length > 0)
    for (const [, value] of here) {
      const existing = entries.get(name)
      if (value === null) {
        if (!existing) throw new Error(`not found: ${path}`)
        entries.delete(name)
      } else {
        if (existing && existing.type === 'tree') throw new Error(`conflict: ${path} is a folder`)
        entries.set(name, { name, mode: BLOB, type: 'blob', oid: value })
      }
    }
    if (below.length) {
      const existing = entries.get(name)
      if (existing && existing.type !== 'tree') throw new Error(`conflict: ${path} is a file`)
      const sub = await apply(backend, existing && existing.oid, below, path)
      if (sub === null) entries.delete(name)
      else entries.set(name, { name, mode: TREE, type: 'tree', oid: sub })
    }
  }
  if (entries.size === 0 && at !== '') return null
  return backend.writeTree([...entries.values()])
}

function steps (path) {
  return path.split('/').filter(Boolean)
}
