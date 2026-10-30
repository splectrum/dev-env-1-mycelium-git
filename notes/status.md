# Phase 1: status (2026-10-30)

The phase is about exploring, implementing and gathering capabilities,
then evaluating and rationalising them. Not running too fast. Built,
tested on every engine and on Bare, and kept as test runs (`test-runs/` on
`main`):

- Packages: mycelium-uri, mycelium-xpath, mycelium-git (one backend
  contract; native git, isomorphic-git and p2p-git adapters, on Node and
  Bare), mycelium-layer, mycelium-repo.
- Capabilities: state/uri, state/xpath, state/git; layer/create, deploy,
  extract, import, export, request (intake and execution); repo/seed,
  publish, sync (publish and sync against stand-in repositories only).
- The test-run model: bare instances seeded, deployed, kicked, kept as
  bundles, inflated and asked again, with pinned and validated machinery.

Deliberately not done in this phase, and not needed now:

- repo/integrity and repo/host; promotion to capability/default with its
  report; this repository running its own operations from
  capability/default (the request's "done"); real publishing and syncing
  to product repositories and remotes; how branches beyond the session's
  own are pushed.
- Network fetch and push in the backend contract. Objects move by direct
  copy (transfer) and by bundles. See the boundary question below.

## The boundary question

The real boundary is between P2P, where we will run, and the outside
world. Fetch and push are how git meets the outside world: a client
deliberately reaches a server. In P2P the same needs can be met by
subscription and background distribution: peers subscribe to what they
need, and replication carries it. Which parts of git's model belong
inside P2P, and which only at the boundary, can only be evaluated in full
once Hypercore is integrated and the core functionality it brings is well
understood. Until then, transfer and bundles are enough to explore with.
