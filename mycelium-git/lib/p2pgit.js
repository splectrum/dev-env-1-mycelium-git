// p2p-git backend: the backend contract on p2p-git, the embedded engine
// (isomorphic-git stripped to plumbing: loose objects only, no working
// tree, pluggable fs, for Bare with bare-fs or Hyperdrive). It keeps
// isomorphic-git's API, so it shares that adapter.

import nodeFs from 'node:fs'
import * as p2pgit from 'p2p-git'
import { isoStyleBackend } from './isogit.js'

export function p2pgitBackend (gitdir, { fs = nodeFs } = {}) {
  return isoStyleBackend(p2pgit, gitdir, { fs })
}
