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
- Refs move only by compare-and-swap. History only grows, and a
  concurrent change fails instead of being overwritten.

## Backend contract

- Reading: `listBranches()` → `[name, commit]` pairs;
  `readCommit(oid)` → `{ tree, parents, message }`; `readTree(oid)` →
  entries `{ name, mode, type, oid }`; `readBlob(oid)` → bytes
- Writing: `writeBlob(bytes)`, `writeTree(entries)`,
  `writeCommit({ tree, parents, message, author, time })` → oid;
  `updateBranch(name, oid, expected)`, compare-and-swap (`null`: must not
  exist)
- History and merge: `mergeBase(a, b)` → oid or `null`;
  `isAncestor(a, b)`; `mergeTrees(ours, theirs)` → `{ tree, conflicts }`

`nativeBackend(dir)` implements it over git's plumbing: the reference.

## Tests

- `npm test`: the unit tests, on a fixture repository
- `test/commands.txt`: invocations for a test run. The first line builds
  the fixture (`test/fixture.sh`, fixed dates, so its oids are stable);
  the writes commit as `cli` at a fixed time, so their oids are stable too,
  and each line's state carries on to the next
