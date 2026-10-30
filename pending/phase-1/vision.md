# Future vision (discussion notes)

Status: not settled, 2026-10-29. These are directions to explore for
viability, not plans for this phase. They're kept here so decisions along
the way can take them into account.

## Bundles as the unit of transport

- Larger units of data move between repositories as git bundles. A
  bundle is a repository packed into one immutable file. It can be
  verified and read with nothing around it, and shared by its own hash.
- The bundles are self-contained data sets, not incremental steps tied to
  what the receiver already has.
- A data set bundle normally carries no history. It's a snapshot: one
  root commit holding the data set's tree, plus the objects it needs.
- Taking a data set in is an ordinary change in the receiving repository,
  through its request flow, not a git merge of histories. The history is
  kept by the receiver: its commits record each import, with the bundle's
  id as the link to the data set. No unrelated histories are joined, so
  "disjoint layers are never merged" still holds.
- Open: where a data set lands. It could be mounted at a path, replacing
  what is there, or combined with what is there, with conflicts on
  shared paths.

## Repositories linking repositories

- A repository links in other repositories, or parts of them (a branch,
  or a folder split into its own branch), for read or for read/write.
- Read: the other data arrives as a bundle and is imported as a layer
  (imported or virtual, as in the rules).
- Read/write: the owning repository stays authoritative. Changes go back
  to it as a bundle, through its request flow, and it executes and merges
  them itself. The owner's link down to the data is authoritative; a copy
  elsewhere is informative.

## P2P and the outside world

- Fetch and push are the outside world's way: a client reaches a server.
  Inside P2P, the same needs are met by subscription and background
  distribution (replication).
- The boundary between the two is to be found, not assumed: which parts
  of git's model live inside P2P, and which only at the edge. To be
  evaluated once Hypercore is integrated and understood.

## Packages and deployments in P2P

An important part of the infrastructure, needed early: to start, run and
use a P2P cluster at all.

- No npm inside P2P. npm is the outside world's distribution (a central
  registry clients fetch from). A package is brought in from the outside
  once, at the boundary, and from then on lives in P2P under its own
  identity.
- Packages are repositories in their own right: our module repositories,
  and third-party packages each brought in once. An instance is a commit
  (named by its id); the repository's history places it.
- A deployment links to packages rather than containing them: a tree of
  links, one per package (git's gitlinks, mode 160000, or a manifest). On
  Hypercore a link is the package repository's key and the commit. Nodes
  load lazily, only what they read, verified by oid. Self-contained means
  complete by reference.
- One by one is the base unit, since packages change independently and are
  shared across deployments. Groups (a functional package, a dependency
  set) are repositories whose trees link packages, and can nest: a
  lockfile made of repositories. To measure: one core per third-party
  package (hundreds) against a vendor repository per group.
- A P2P cluster's prerequisites are availability, not installation: the
  runtime on each node (Bare), the package repositories reachable in the
  cluster, and at least one always-on peer seeding them.
- Creating a cluster: a self-contained deployment repository that stays
  alive for the duration of the deployment. It holds what the cluster is
  (its deployment, its links, its nodes) and is the cluster's reference
  while it runs.
- Monitoring and management have to be considered from the start: the
  cluster's state, its health, its nodes and their deployments, kept and
  reached through repositories and requests like everything else.
- To try in the Hypercore phase: gitlinks or a manifest; per-package cores
  against groups; lazy loading from linked repositories; a deployment
  repository bringing up nodes in containers.

## The package repository and the seed node (scope for the roadmap)

A prerequisite for the P2P cluster work: an initial version comes first.

The package repository:

- One repository holds the packages' actual content, the data on disk.
  Every other repository holds only links. Each package instance is stored
  once, however many deployments use it.
- Layout (a first proposal): one branch per package (e.g. `data/<package>`),
  each instance a commit holding the package's tree, named by its id. Our
  modules arrive through repo/publish; third-party packages once, at the
  boundary, from installed `node_modules` folders.
- A deployment's tree holds gitlinks (mode 160000), one per package, each
  pointing to the package's commit in the package repository.
- Materialising a deployment on a node: each link resolved against the
  package repository and extracted into the folder layout Node and Bare
  expect (layer/extract, per link). The non-lazy, filesystem version of
  what Hypercore will do lazily.
- It can be built and tested in git first, in the test-run model (deploy
  by links, materialise, run the same tests, compare the records), before
  replication changes how it's reached. It also ends the bundle-size
  problem: instances hold links, the package repository holds the bytes.

The seed node:

- No heavy prebuilt images. A container, or any other platform that is a
  node, starts from a plain base with the runtime (Bare) only; everything
  else arrives as repositories.
- A self-contained bootstrap repository runs on it, a process that sets up
  the cluster's seed node: obtain the package repository, materialise what
  the node needs, start the node.
- The seed node is the first always-on peer. It seeds the package
  repository and is where other nodes join (discovery, bootstrap). A later
  node needs only the bootstrap repository and the seed node's key; the
  rest comes from the cluster, lazily.
- The one bootstrap problem: the very first repository comes from the
  outside world, as a bundle copied or mounted in, or a clone at the
  boundary. Every node after the seed node gets it from the cluster.

## Operators: single-concern repositories

- Single concern rather than all in one. A deployment is a multistep
  process, and each step or batch is its own self-contained repository: an
  operator. An operator does its one step and keeps the record of it.
- The test-run instance is the first operator already: seeded, deployed,
  executing its requests, recording everything, kept.
- A deployment as a chain of operators, for example: a package operator
  (builds the package repository), a bootstrap operator (the bootstrap
  repository for a platform), a container operator (starts containers from
  a plain base, hands each its bootstrap repository), a seed operator (turns
  the first container into the seed node), a join operator (brings more
  nodes in). The deployment repository holds the chain, its state and its
  monitoring while the deployment lives.
- Operators connect by the existing rules: input arrives as a request on
  the operator's pending/default (with links or bundles); output is its
  response on main; the next operator takes it in itself (import). Nobody
  writes into another repository. Every step is recorded as units, so a
  deployment can be traced step by step and each step rerun on its own.
- With the current mycelium-git functionality this can start now: the
  request flow and units, seed, deploy, extract, import and export,
  bundles as transport between operators, Docker for containers. P2P can
  begin as plain git between containers.
- The order this gives: operator repositories and the package repository
  first, building up to a container cluster deployed by a chain of
  operators; then the Hypercore work on that infrastructure.

## Storage and deltas

- Loose objects stay the model and the working store: each object
  addressable by its oid, never rewritten.
- Less reliance on delta compression. Bundles are the transport; deltas
  only save bytes in transit, an optimisation for later.
- Seen in a probe (2026-10-29, `probes/`): p2p-git's internal pieces can already
  write a bundle native git accepts and read a native bundle with deltas
  into loose objects. Its pack parser decodes delta offsets wrongly; the
  raw bytes are kept, so it's a small fix.

## The mycelium base layer

From the bottom:

- **Hypercore**: the underlying layer, for storage and replication.
  Hyperdrive and the filesystems git engines run on sit here.
- **mycelium-git**: objects, trees, checkpoints and the repository rules.
  Structure-unaware, so file extensions are part of its URIs.
- **AVRO**: objects become data structures, with schemas and typed values.
  From here up, a URI names a typed value, not stored bytes.
- **Kafka**: data streaming and large data sets, records and topics.

**mycelium-uri** and **mycelium-xpath** are the shared vocabulary across
all four: URIs name branches and files, typed values and topics; xpath
navigates any tree, AVRO structures included.

On top of the base layer sit the **repository paradigms**: the dev env
repository, the test-run instance, the module repository, data instance
repositories, and more. Each is its own set of rules and capabilities for
one kind of repository. The request flow, deploy, publish and sync belong
to the paradigms that use them, not to the base.

## p2p-Kafka on Hypercore (thoughts)

Hypercore is already most of what Kafka is underneath: an ordered,
append-only, replicated log read by offset, and signed and verifiable on
top.

- Partition = one Hypercore. Offset = block index. Record = one block
  (key, value, headers; the value AVRO-encoded). Topic = a named set of
  cores (Corestore namespaces). Replication through Hyperswarm; sparse
  replication for consumers reading ranges.
- Multiple producers: a Hypercore has one writer, so partition by
  producer, with ordering per partition, as in Kafka. Autobase only where
  one global order is needed.
- Consumer positions are the consumer's own state, kept in git.
- Retention: clear blocks locally. Compaction (latest per key) is
  Hyperbee, not a log.
- No central broker cluster, ZooKeeper or KRaft: a single-writer,
  signed log needs no leader to order writes or arbitrate replication.
  But broker functions remain, taken on by peers: availability when the
  producer is offline (always-on seeding peers; blind peers, data/blind),
  discovery (Hyperswarm's DHT), and coordination of consumer groups (a
  shared state such as Autobase, or a fixed rule). Retention and access
  are each peer's own, and access comes from holding the keys.
- Fits the unit model: a core is immutable up to its length, so a unit
  can record its input streams as (core key, length) next to its branch
  commits, and a rerun is exact for streams too.
- A first probe, in the test-run model: one topic, one partition, under
  Bare. Produce, consume from an offset, replicate to a second peer, and
  record the consumer's position in git. Start from splectrum/spl6's
  P2P primitives.
