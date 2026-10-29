// repo/publish: a folder package published to its product repository.
// The folder is split out of main's history (as git subtree split, no
// --rejoin) into publish/<package>, a branch derived from main. The split
// is then pushed, plainly, to the product repository's execute/main, and
// the product repository merges it into its main itself (receive).

import { split, transfer, writer } from '../../mycelium-git/index.js'

const headOf = async (backend, branch) => Object.fromEntries(await backend.listBranches())[branch]

// repo, product: backends, any engines. pkg: the package's folder, at the
// root of main. Resolves { split, copied }.
export async function publish ({ repo, pkg, product }) {
  const main = await headOf(repo, 'main')
  if (!main) throw new Error('no branch: main')
  const head = await split(repo, main, pkg)
  if (!head) throw new Error(`no folder: ${pkg}`)
  await writer(repo).advance(`publish/${pkg}`, head)
  const copied = await transfer(repo, product, head)
  await writer(product).advance('execute/main', head)
  return { split: head, copied }
}

// The product repository's side: execute/main merged into main with a plain
// merge; on the first publish, main starts from it.
export async function receive ({ product, message, author, time }) {
  const w = writer(product)
  const exec = await headOf(product, 'execute/main')
  if (!exec) throw new Error('no branch: execute/main')
  if (!await headOf(product, 'main')) return w.advance('main', exec)
  return w.merge('execute/main', 'main', message, { author, time })
}
