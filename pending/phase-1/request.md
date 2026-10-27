# Request: first development phase

From: `splectrum/roadmap-1`, 2026-10-27

## First: plant this seed

This seed was prepared in `splectrum/roadmap-1` under
`seeds/dev-env-1-mycelium/`. Plant it by hand; this is the bootstrap.

1. Put `README.md`, `CLAUDE.md` and `rules.md` on `main`.
2. Create `pending/default` as an orphan branch holding this request in
   `pending/` (as `pending/phase-1/request.md`).
3. Create `execute/main` from `main`.

Settle with the human how branches beyond the session's own are pushed.

## The phase

**First development phase** (proposal): the self-contained repository's
rules on git, with XPath access — one repository, using itself.

- **All git implementations:** one backend contract (objects, refs,
  commit, merge, fetch, push), an adapter per implementation (native git,
  isomorphic-git on Node and on Bare), one test suite run against each.
- **Capabilities:** `state/uri`, `state/xpath`, `state/git`; `layer/create`,
  `layer/deploy`, `layer/extract`, `layer/request`, `layer/import`,
  `layer/export` (`layer/compose` stays open); `repo/seed`,
  `repo/integrity`, `repo/host`, `repo/sync`, `repo/publish`.
- **The capability layer is self-contained:** its categorisation and
  implementation details are local to it, not inherited by future
  capability layers; its content is complete and internally consistent,
  so reading it is enough to use it.
- **Development is data, operation is deployed:** the capability code is
  developed on `main`, deployed into `capability/default` to operate, and
  into a parallel `capability/<name>` (e.g. `capability/test`) to test run
  without touching the operational layer. Promotion deploys the tested
  tree; the first deployment is a bootstrap by hand.
- **Packages:** `mycelium-uri` (our URIs, generic) and `mycelium-xpath`
  (tree navigation, generic) as helpers; `mycelium-git` on them — all the
  repository rules (branches, layers, flows, safe operations, URI access
  from the branch root) over a backend contract. Engines: native git as
  reference (from `bare-for-pear/git`), `p2p-git` on bare-fs or Hyperdrive
  as the embedded engine, to be finished (merge and index flow untested).
- **One development repository per phase**, packages as folders on its
  `main`. Each package is published by subtree split into
  `publish/<package>` and a plain push to its product repository's
  `execute/main`; the human syncs from local for now. Product repositories
  are created by the human.
- **Done:** the repository runs its own operations on its deployed
  `capability/default`, after a test run on `capability/test`.


## Background

In `splectrum/roadmap-1`: `capabilities.md` (the capability list),
`capabilities/reuse.md` (reuse candidates, pinned by commit, with their
assessment), `capabilities/env/sense/` (a first Bare probe), and the
commit history, which carries the discussion behind every proposal.
