# mycelium-git

The repository rules over a backend contract. First slice: reading a
repository by path, from the branch root.

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
- Paths are valid when they come in: validation is at the boundary (here,
  `cli.js` validates with `mycelium-uri`).

## Backend contract (first slice)

- `listBranches()` → `[name, commit]` pairs
- `readCommit(oid)` → `{ tree, parents, message }`
- `readTree(oid)` → entries `{ name, mode, type, oid }`
- `readBlob(oid)` → bytes

`nativeBackend(dir)` implements it over git's plumbing: the reference.

## Tests

- `npm test`: the unit tests, on a fixture repository
- `test/commands.txt`: invocations for a test run. The first line builds
  the fixture (`test/fixture.sh`, fixed dates, so its oids are stable)
