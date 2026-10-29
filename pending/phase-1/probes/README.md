# Probes (discussion material)

Throwaway scripts from 2026-10-29, kept as the evidence behind the notes in
`vision.md`. They use absolute paths of the session they ran in and import
p2p-git's internals from a local clone at commit 01cac42; they are not code
under development.

- `bundle-write.mjs`: writes a bundle of all branches with p2p-git's
  internal `listObjects` and `_pack`. Native git verified and cloned it,
  and `fsck --full` was clean.
- `bundle-read.mjs`: reads a native bundle with delta-compressed objects
  into loose objects with p2p-git's `listpack` and `applyDelta`. It decodes
  delta offsets itself (`gitOfs`), because `listpack`'s `ofs` is wrong. The
  result had the same commits and head, and `fsck` was clean.
- `p2pgit-adapter.mjs`: ran a write and merge scenario on native git and on
  p2p-git through the isomorphic-git-style adapter: identical oids and
  outcomes.
