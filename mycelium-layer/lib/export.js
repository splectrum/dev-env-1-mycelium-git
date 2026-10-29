// layer/export: a layer made available to others, as a bundle file: the
// layer with its history, self-contained (no prerequisites). The receiving
// repository takes it in itself, with importBundle: nobody writes into
// another repository.

import fs from 'node:fs'
import { readBundle, writeBundle, writer } from '../../mycelium-git/index.js'

// backend: the repository; layer: the branch; file: the bundle to write.
// Resolves { commit, bytes }.
export async function exportLayer ({ backend, layer, file }) {
  const commit = Object.fromEntries(await backend.listBranches())[layer]
  if (!commit) throw new Error(`no branch: ${layer}`)
  const bytes = await writeBundle(backend, { [layer]: commit })
  fs.writeFileSync(file, bytes)
  return { commit, bytes: bytes.length }
}

// The receiver's side: a bundle's layer taken in, under the layer rules
// (importLayer: new, an allowed name and a leaf; existing, only forward).
// branch: which of the bundle's branches (default its only one); as: its
// name here (default the same). Resolves { commit, objects }.
export async function importBundle ({ backend, file, branch, as }) {
  const { branches, objects } = await readBundle(backend, fs.readFileSync(file))
  const names = Object.keys(branches)
  if (!branch) {
    if (names.length !== 1) throw new Error(`name a branch: the bundle holds ${names.join(', ')}`)
    branch = names[0]
  }
  if (!branches[branch]) throw new Error(`not in the bundle: ${branch}`)
  await writer(backend).importLayer(as || branch, branches[branch])
  return { commit: branches[branch], objects }
}
