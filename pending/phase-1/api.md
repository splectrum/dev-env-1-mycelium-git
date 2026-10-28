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

## Instrumentation and audit (from the ground up)

- Every operation, at every level (uri, xpath, backend, rules,
  capability), goes through one wrapper that emits an event: `{ run,
  seq, parent, level, op, args, result, ms, error }`. Bytes are
  recorded by oid and size, not content. `parent` links the events
  into a call tree, so a capability call shows its git operations.
- Every package takes a `sink`; none writes the audit log itself. The
  test suite uses a memory sink; a run uses a repository sink.
- In a run, the audit log is execution data of the run's request. It is
  kept in the execution instance repository, on its own
  `pending/default`, under `pending/<request>/runs/<run>/`, as JSON
  lines committed at step boundaries. The sink writes through the
  uninstrumented backend, so auditing never audits itself.

## Test run

Test runs happen in an execution instance repository, not in this dev
repository. This repository stays the development source.

1. Seed: `repo/seed` creates the instance repository from this one: the
   code from `main`, the run's request on its `pending/default`, and
   `execute/main`.
2. From then on the instance repository does everything itself. It
   deploys into its `capability/test` (`layer/deploy`), runs from there,
   and works through the request flow. Its origin and product
   repositories are local bare repositories.
3. Everything is logged into the instance repository itself.
4. Analyse: a separate step reads only the instance repository. It
   checks the audit log, `repo/integrity` and the layers, and writes a
   report with its verdicts.

The instance repository holds all of its data, as the rules say for data
from a unit in operation. Only the report comes back here, as the
response to the request. Where instance repositories live (local,
or hosted when the human creates one) is open.

## Requests as the public API

A repository is used only through its request flow. Nobody reaches into
it; you put a request in its `pending/default`, and it executes the
request with its own deployed capabilities. The response comes back
through `execute/*` into its `main`.

- A kept run is stored here as data: a git bundle at
  `pending/<request>/runs/<run>.bundle`. It is not a working repository.
- To get anything from a stored run, such as its report or a fresh
  analysis:
  1. Inflate the bundle (`git clone --bare`).
  2. Put the request into the run's `pending/default`.
  3. The run executes it on its own `capability/default`.
  4. Read the response from its `main`, or bundle the run again.
- The analysis at the end of a run is itself such a request.

## Promotion carries its evidence

- Promotion (`capability/test` → `capability/default`) deploys the
  tested tree together with the summary report of the run that tested
  that exact tree: what ran, on which engines and runtimes, and the
  verdicts. The layer stays self-contained: reading it shows what it
  does and that it was tested.
- The deploy commit references its source commit on `main`, the run id
  and where the run's bundle is kept. The full evidence is reached
  through the run's request API, not copied into the layer.
- `repo/integrity` checks it: no tree on `capability/default` without a
  passing report for that tree. The exception is the first deployment,
  a bootstrap by hand, which is marked as one.
- Open: one report per capability, or one for the whole layer.

## Code, capabilities and data

- Module code as folders on `main` exists only in the dev repository,
  where code is what is being developed. Each module is published to its
  own repository.
- In an instance repository, code exists only in the capability layer.
  Its `main` holds data only. Deployed functionality is never data.
- The capability layer is organised by capability URI (`state/uri`,
  `layer/request`, …). Within the layer, scripts map capability URIs to
  the deployed module folders.
- Global capabilities apply everywhere. Non-global (local-scope)
  capabilities are mapped to data folders, disjointly. An overlay
  mirrors the data folder structure by `main`'s paths (as
  `overlay/config` in the rules) and refers to capabilities by URI. The
  structure is imported into the overlay. Data holds no links to
  capabilities, and capabilities hold no links to data. The overlay
  alone relates them.
- External APIs are built on top later.

## Request state

- Execution runs on `execute/<target>`, from a fixed data state: the
  target is merged in before execution, and the branch receives only the
  response.
- Request state (the request, its discussion, execution data, verdicts)
  is a subfolder `pending/<request>/` on `pending/default`.
- For parallel execution later: `pending/<request>` branches, orphan,
  plain-merged into `pending/default` on completion and deleted with
  `-d`. Folder and branch names follow the same segment rules, so the
  move needs no renaming. That would mean `pending/default` receives
  merges, which must be stated in the rules.

## Open

- Runtime order: Node first (native git and isomorphic-git), then Bare?
- The p2p-git transport for fetch/push.
