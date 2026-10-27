# API proposal — phase 1 (discussion notes)

Status: proposal, 2026-10-27. Built on `pear-full-square/mycelium@9f63cce`
`lib/`, `bare-for-pear/git` and `bare-for-pear/p2p-git`.

All packages: ES modules, async, plain functions, throw on error.

## mycelium-uri (generic)

- `isSegment(s)`: true when `s` is `[a-z0-9-]+`
- `parse(uri)` → `{ segments }`. Throws if the URI isn't absolute, has a
  scheme, query or fragment, or has a bad segment
- `format(segments)` → `'/a/b'`
- `split(uri, branches)` → `{ branch, path }`, where `branches` is the
  set of known branch names. Because a branch is a leaf and no name is
  both a branch and a prefix, at most one branch matches. Throws on none
- `join(uri, ...segments)`, `parent(uri)`

## mycelium-xpath (generic)

Works over any tree through an accessor, so it doesn't depend on git:
`{ list(node) → [{ name, node, type }], read(node) }`.

- `resolve(tree, path)` → node or `null`
- `select(tree, expr)` → nodes, always an array. First subset: `/`
  steps and `*`. `//` and predicates come later, when something needs
  them
- No underscore metadata mode. It was dropped in the new rules.

## Backend contract (in mycelium-git)

One interface, one adapter per engine, one test suite run against each.

- Objects: `readBlob`, `writeBlob`, `readTree`, `writeTree`,
  `readCommit`, `writeCommit`
- Refs: `resolveRef`, `listRefs(prefix)`,
  `updateRef(ref, oid, expectedOld)` (compare-and-swap; `null` means
  "must not exist"), `deleteRef(ref, expectedOld)`. There is no force:
  history only grows
- History: `isAncestor(a, b)`, `mergeBase(a, b)`
- Merge: `mergeTrees(base, ours, theirs)` → `{ tree, conflicts }`
- Remote: `fetch(remote, refs)`, `push(remote, refs)`, non-forced
  only

Adapters:
- **native**: git plumbing (`hash-object`, `mktree`, `commit-tree`,
  `update-ref <old>`, `merge-tree --write-tree`, `fetch`, `push`). This
  is the reference
- **isomorphic-git**: on Node fs, then on Bare
- **p2p-git**: on bare-fs or Hyperdrive. It has no network, so
  fetch/push need a transport. Open question

## mycelium-git (the rules)

- `open(backend)` → repo
- URI access from the branch root: `read(uri)`, `list(uri)`,
  `select(uri-or-xpath)`. The branch is found with `mycelium-uri.split`
  against `listRefs('refs/heads/')`
- Writes: `change(branch)` → `put(path, bytes)`, `remove(path)`,
  `commit(message)`. The ref is moved by compare-and-swap; a concurrent
  change fails, it never overwrites. This replaces mycelium's force
  update and its hard-coded `main`
- Rules:
  - `createLayer(name)`: orphan, reserved first segment checked
  - `merge(from, into)`: a plain merge commit; no squash, no rebase
  - `deleteBranch(name)`: only if merged
  - `checkIntegrity()`: layers disjoint, `main` changes only by merges,
    history only grows
- The capabilities (`layer/*`, `repo/*`) are built on this API, never
  on git directly.

## Open

- Runtime order: Node first (native git and isomorphic-git), then Bare?
- The p2p-git transport for fetch/push.
