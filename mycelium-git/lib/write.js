// Writing under the rules: a change is a set of puts and removes on one
// branch, committed as one checkpoint; a merge is a plain merge; branches
// are created and deleted only as the rules allow. Refs move only by
// compare-and-swap, so history only grows and a concurrent change fails
// instead of being overwritten.
//
// Paths are inside the branch ('/responses/r1/response.md'), stored names,
// valid: they are validated at the boundary, not here.

const BLOB = '100644'
const TREE = '040000'

// First segments of layers, which start as orphans. execute and publish
// branches are derived from another branch, not created as layers.
const LAYERS = ['main', 'pending', 'overlay', 'data', 'capability']
// Every reserved first segment: a branch name starts with one.
const RESERVED = [...LAYERS, 'execute', 'publish']
// Permanent: never deleted.
const PERMANENT = ['main', 'pending/default']

// A layer's name: its first segment is a layer's, with more segments after
// it, except main, which is a layer on its own.
function layerName (name) {
  const first = name.split('/')[0]
  if (!LAYERS.includes(first) || (first === 'main' ? name !== 'main' : name === first)) {
    throw new Error(`not a layer: ${name}`)
  }
}

export function writer (backend) {
  const branches = async () => Object.fromEntries(await backend.listBranches())
  const head = async branch => (await branches())[branch]

  // A new branch name must not be, or be under, or hold, an existing one:
  // a name is never both a branch and a prefix.
  async function free (name) {
    for (const existing of Object.keys(await branches())) {
      if (existing === name) throw new Error(`exists: ${name}`)
      if (name.startsWith(existing + '/') || existing.startsWith(name + '/')) {
        throw new Error(`not a leaf: ${name} and ${existing}`)
      }
    }
  }

  return {
    // A new layer: an orphan branch whose first commit has an empty tree.
    // Its first segment must be a layer's (main is a layer of its own).
    async createLayer (name, message, { author, time } = {}) {
      layerName(name)
      await free(name)
      const tree = await backend.writeTree([])
      const oid = await backend.writeCommit({ tree, parents: [], message, author, time })
      await backend.updateBranch(name, oid, null)
      return oid
    },

    // A branch set to a commit whose objects are already here (see
    // transfer), forward only: an existing branch moves only to a commit
    // that holds its current one in its history. A new one must start with
    // a reserved segment and be a leaf.
    async advance (name, commit) {
      if (!await backend.hasObject(commit)) throw new Error(`no commit: ${commit}`)
      const current = await head(name)
      if (current) {
        if (current === commit) return commit
        if (!await backend.isAncestor(current, commit)) throw new Error(`diverged: ${name}`)
        await backend.updateBranch(name, commit, current)
        return commit
      }
      if (!RESERVED.includes(name.split('/')[0]) || name === 'execute' || name === 'publish') {
        throw new Error(`not a branch name: ${name}`)
      }
      await free(name)
      await backend.updateBranch(name, commit, null)
      return commit
    },

    // A layer taken in from another repository, with its history: advance,
    // under the layer rules for a new one.
    async importLayer (name, commit) {
      if (!await head(name)) layerName(name)
      return this.advance(name, commit)
    },

    // The execution branch of a target: execute/<target>, from its head.
    async createExecution (target) {
      const from = await head(target)
      if (!from) throw new Error(`no branch: ${target}`)
      const name = `execute/${target}`
      await free(name)
      await backend.updateBranch(name, from, null)
      return from
    },

    // Delete a branch, only once it is merged: its head is in into's history.
    async deleteBranch (name, into) {
      if (PERMANENT.includes(name)) throw new Error(`permanent: ${name}`)
      const b = await branches()
      if (!b[name]) throw new Error(`no branch: ${name}`)
      if (!b[into]) throw new Error(`no branch: ${into}`)
      if (!await backend.isAncestor(b[name], b[into])) throw new Error(`not merged: ${name} into ${into}`)
      await backend.deleteBranch(name, b[name])
    },

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

    // A checkpoint replacing a branch's whole tree with tree, whose objects
    // are already here: one commit on the branch's head. A deployment, for
    // example.
    async commitTree (branch, tree, message, { author, time } = {}) {
      const start = await head(branch)
      if (!start) throw new Error(`no branch: ${branch}`)
      const oid = await backend.writeCommit({ tree, parents: [start], message, author, time })
      await backend.updateBranch(branch, oid, start)
      return oid
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
