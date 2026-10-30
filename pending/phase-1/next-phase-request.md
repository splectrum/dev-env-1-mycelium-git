# Request (draft): second development phase

From: dev-env-1-mycelium, 2026-10-30. A draft for `splectrum/roadmap-1`, to
be prepared there as a seed. The name `dev-env-2-operators` is a
placeholder.

## The phase

**Second development phase** (proposal): operators and the package
repository, up to a container cluster: a deployment as a chain of
single-concern repositories, using the first phase's mycelium modules.

- **Operators:** single-concern, self-contained repositories. An operator
  does one step of a deployment and keeps the record of it. Its input
  arrives as a request on its `pending/default` (with links or bundles),
  its output is its response on `main`, and the next operator takes that
  in itself (import): nobody writes into another repository. Every step is
  recorded as units, so a deployment can be traced step by step and each
  step rerun on its own. The first phase's test-run instance is the first
  operator.
- **The package repository:** one repository holds the packages' content,
  the data on disk, and every other repository holds only links. A branch
  per package, each instance a commit named by its id. Our modules arrive
  by `repo/publish`; third-party packages once, at the boundary, from
  installed `node_modules`. A deployment's tree holds gitlinks (mode
  160000), one per package. Materialising a deployment on a node resolves
  each link against the package repository and extracts it.
- **The deployment repository:** self-contained, alive for the duration of
  the deployment. It holds the chain of operators, the deployment's state,
  and its monitoring: the cluster's nodes, their deployments and their
  health, kept and reached through requests like everything else.
- **The seed node:** no heavy prebuilt images. A container (or any other
  platform) starts from a plain base with the runtime (Bare) only. A
  self-contained bootstrap repository runs on it and sets up the seed
  node: obtain the package repository, materialise what the node needs,
  start the node. The first repository comes from the outside world (a
  bundle copied or mounted in); every later node gets it from the cluster.
- **Containers as nodes:** Docker. A chain of operators, for example
  package, bootstrap, container, seed and join. P2P starts as plain git
  between containers, with bundles as transport.
- **Packages:** the first phase's `mycelium-uri`, `mycelium-xpath` and
  `mycelium-git` as the base, used from their product repositories;
  operators as new packages, with what they share as modules.
- **Done:** a container cluster (a seed node and at least one more node)
  deployed from a deployment repository by a chain of operators, from a
  plain base, with every step recorded and rerunnable, and kept.

**Then:** the Hypercore work, on that infrastructure: Corestore; Hyperdrive
under p2p-git; Hyperbee as a candidate for refs; replication between
container nodes; subscription and background distribution in place of
fetch and push; lazy loading from the package repository; the boundary
between P2P and the outside world, evaluated once Hypercore is
understood. A p2p-Kafka probe on Hypercore belongs here too.

## Recommendations

From the first phase's experience:

1. **Before seeding this phase:** evaluate the first phase, rationalise its
   modules, and publish the base modules (`mycelium-uri`,
   `mycelium-xpath`, `mycelium-git`) to their product repositories, as
   the first real use of `repo/publish`. Keep `mycelium-layer` and
   `mycelium-repo` in the first repository until the paradigms are
   clearer; this phase's operators will show what they should become.
2. **Package repository first, in git.** Deploy by links, materialise, and
   run the first phase's test commands from a materialised deployment: the
   records must come out the same as from a copied one. That also ends the
   bundle-size problem (16 MB per kept run, and growing).
3. **One thin chain end to end before generalising:** two operators (a
   package operator and a seed operator) and one container, then add
   steps. Keep each operator to one concern.
4. **Probe the environment early:** `env/docker` (the daemon, starting it,
   container limits in a cloud session) and `env/udp` (needed later for
   Hyperswarm). Run Bare in a plain container before anything depends on
   it.
5. **Keep the first phase's practice:** test runs with expectations in the
   requests, reports as requests, kept bundles as data on `main`,
   machinery pinned by id and validated before the pin moves.
6. **Measure as you go:** object counts, sizes and times per operator and
   per deployment. The Hypercore decisions (per-package cores or groups,
   batching) need numbers.
7. **Carry over two fixes for p2p-git's `hyperdrive-fs.js`:** folders
   reported as folders (`Stats(null)` reports not-a-folder) and `readlink`
   and `symlink` added. `mycelium-git`'s `hyperdriveFs` works around both.

## Open questions

- Gitlinks or a manifest for a deployment's links.
- One repository per third-party package, or a vendor repository per group.
- How the bootstrap repository reaches the first container (a mounted
  bundle, a copy, or a clone at the boundary).
- The minimum of monitoring and management for this phase.
- How branches beyond a session's own are pushed (still open from the
  first phase).

## Background

In `dev-env-1-mycelium` (this phase's repository): `pending/phase-1/`
(the request, `api.md`, `vision.md`, `status.md`, `probes/`) on
`pending/default`; the modules, the test-run machinery and the kept runs
(`test-runs/`) on `main`.
