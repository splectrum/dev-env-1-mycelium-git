# mycelium-git

Our git, speaking mycelium: the repository rules over a backend contract.
Reading a repository by path from the branch root, and writing changes and
plain merges under the rules. The rules code uses only the backend
contract; an adapter maps the contract onto one engine.

## A repository as one tree

Every path starts with a branch name, from the root: `/main/docs/a`,
`/pending/default/pending/r1`. Above the branches the tree is made of
their name segments (`/pending` holds `default`); a full branch name is
its commit's tree. A name is never both a branch and a prefix, so this is
unambiguous. `mycelium-xpath` navigates it, `*` steps included:
`/*/*/docs/a` finds `docs/a` in every two-segment branch.

- `openRepo(backend)` → `{ select(path), read(path) }`
  - `select(path)` → `[path, node]` pairs; a node is
    `{ type: 'tree' | 'blob', oid }`, or `{ type: 'branches', prefix }`
    above the branches
  - `read(path)` → the content of the one file at `path`, as bytes
- `pinned(backend, state)` → the backend with its branches fixed to the
  commits in `state` (`{ branch: commit }`): a repository at a recorded
  state, such as a unit's
- Inside, paths are stored names and match exactly. The boundary (here,
  `cli.js`) runs its own process for an external URI: `validate` it with
  `mycelium-uri`, then select with `sameName` to find the stored names;
  `select(path, match)` and `read(path, match)` take it.

## Writing under the rules

`writer(backend)` → `{ change, merge }`. Paths are inside the branch and are
stored names, valid when they come in.

- `change(branch)` → `{ put(path, bytes), remove(path), commit(message,
  { author, time }) }`. The puts and removes are committed as one
  checkpoint. A file over a folder (or the other way round), a remove of
  something missing, or a missing branch throws. Folders left empty
  disappear.
- `merge(from, into, message, { author, time, fastForward })`: a plain
  merge commit, or nothing when `into` already holds `from`. Disjoint
  layers are never merged, and conflicts throw. `fastForward` lets `into`
  simply move to `from` when it can, for syncing an execution branch,
  never for `main`.
- `createLayer(name, message, { author, time })`: a new layer, an orphan
  branch whose first commit has an empty tree. Its first segment must be a
  layer's: `main` (on its own), `pending`, `overlay`, `data` or
  `capability`. `execute` and `publish` branches are derived, not layers.
- `createExecution(target)`: `execute/<target>`, from the target's head.
- `deleteBranch(name, into)`: only once merged, with its head in `into`'s
  history. `main` and `pending/default` are permanent.
- A new name is never both a branch and a prefix: `data/sets` and
  `data/sets/more` can't both exist, nor `data` beside `data/sets`.
- Refs move only by compare-and-swap. History only grows, and a
  concurrent change fails instead of being overwritten.

## Backend contract

- Reading: `listBranches()` → `[name, commit]` pairs;
  `readCommit(oid)` → `{ tree, parents, message }`; `readTree(oid)` →
  entries `{ name, mode, type, oid }`; `readBlob(oid)` → bytes
- Writing: `writeBlob(bytes)`, `writeTree(entries)`,
  `writeCommit({ tree, parents, message, author, time })` → oid;
  `updateBranch(name, oid, expected)`, compare-and-swap (`null`: must not
  exist); `deleteBranch(name, expected)`, the same
- History and merge: `mergeBase(a, b)` → oid or `null`;
  `isAncestor(a, b)`; `mergeTrees(ours, theirs)` → `{ tree, conflicts }`

Adapters, one per engine, each run against the same contract suite
(`test/contract.js`):

- `nativeBackend(gitdir)`: git's plumbing, the reference
- `p2pgitBackend(gitdir, { fs })`: p2p-git, the embedded engine:
  isomorphic-git stripped to plumbing (loose objects only, no working
  tree, pluggable fs, for Bare with bare-fs or Hyperdrive). It keeps
  isomorphic-git's API, so it shares that adapter (`isoStyleBackend`)
- `isogitBackend(gitdir, { fs })`: isomorphic-git (1.44.8) over a
  filesystem, node's by default. For compatibility: the same repository,
  read and written by an engine that also runs where native git does not.
  It has no atomic compare-and-swap, so `updateBranch` compares, then
  writes. Its merge stores the merged tree only through a real merge, so
  `mergeTrees` leaves an unreferenced merge commit, which git's garbage
  collection removes.

Both run on Node and on Bare. On Bare the Node built-ins they use come from
the `bare-node-*` aliases, which are dependencies of this package; Node
ignores them, since its own built-ins come first. The Bare runtime itself
is the environment, like Node and git: installed where the module runs
(`npm install -g bare@1.36.0`), not with the module.

A commit message always ends with a newline, as git's own commits do, so
the same writes give the same oids on every engine (`test/engines.test.js`).

## Tests

- `npm test`: the contract suite on each engine, and the cross-engine test,
  on a fixture repository (bare)
- `test/commands.txt`: invocations for a test run. The first line builds
  the fixture (`test/fixture.sh`, fixed dates, so its oids are stable);
  the writes commit as `cli` at a fixed time, so their oids are stable too,
  and each line's state carries on to the next. `test/commands-isogit.txt`
  is the same on isomorphic-git (`--engine=isogit`), and
  `test/commands-p2pgit.txt` on p2p-git, and `test/commands-bare-*.txt` the
  same on Bare, all with the same expectations. `node test/variants.js`
  generates those from `commands.txt`
