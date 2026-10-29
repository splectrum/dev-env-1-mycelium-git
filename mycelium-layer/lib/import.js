// layer/import: take a layer in from another repository, with its history.
// The receiving repository does it itself: it copies the objects the layer
// reaches, then takes the branch in under the layer rules (new: an
// allowed layer name; existing: only forward). Nobody writes into another
// repository.

import { transfer, writer } from '../../mycelium-git/index.js'

// from, to: backends, any engines. branch: the layer in from; as: its name
// here (default the same). Resolves { commit, copied }.
export async function importLayer ({ from, to, branch, as = branch }) {
  const commit = Object.fromEntries(await from.listBranches())[branch]
  if (!commit) throw new Error(`no branch: ${branch}`)
  const copied = await transfer(from, to, commit)
  await writer(to).importLayer(as, commit)
  return { commit, copied }
}
