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
- Not needed: brokers, ZooKeeper or KRaft, cluster-wide transactions.
- Fits the unit model: a core is immutable up to its length, so a unit
  can record its input streams as (core key, length) next to its branch
  commits, and a rerun is exact for streams too.
- A first probe, in the test-run model: one topic, one partition, under
  Bare. Produce, consume from an offset, replicate to a second peer, and
  record the consumer's position in git. Start from splectrum/spl6's
  P2P primitives.
