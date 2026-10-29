// layer/extract: a layer, or a folder in it, extracted to a folder on disk
// as a folder package, with its provenance recorded. Files get their mode
// back as git records it (executable, symbolic link, or plain). The
// provenance is written beside the folder, as <folder>.provenance.json, so
// the folder is exactly the tree: deployed again, it gives the same tree.

import fs from 'node:fs'
import { join } from 'node:path'

// backend: the repository; layer: the branch; path: a folder in it ('/' for
// the whole layer); folder: on disk, must not exist; source: optional, where
// the repository is, for the record. Resolves the provenance:
// { source, layer, path, commit, tree, files }.
export async function extract ({ backend, layer, path = '/', folder, source }) {
  if (fs.existsSync(folder)) throw new Error(`exists: ${folder}`)
  const commit = Object.fromEntries(await backend.listBranches())[layer]
  if (!commit) throw new Error(`no branch: ${layer}`)
  let tree = (await backend.readCommit(commit)).tree
  for (const name of path.split('/').filter(Boolean)) {
    const entry = (await backend.readTree(tree)).find(e => e.name === name)
    if (!entry || entry.type !== 'tree') throw new Error(`not a folder: ${path}`)
    tree = entry.oid
  }
  const count = { files: 0 }
  await writeTree(backend, tree, folder, count)
  const provenance = { ...(source && { source }), layer, path, commit, tree, files: count.files }
  fs.writeFileSync(`${folder}.provenance.json`, JSON.stringify(provenance, null, 2) + '\n')
  return provenance
}

async function writeTree (backend, tree, dir, count) {
  fs.mkdirSync(dir, { recursive: true })
  for (const e of await backend.readTree(tree)) {
    const path = join(dir, e.name)
    if (e.type === 'tree') {
      await writeTree(backend, e.oid, path, count)
    } else if (e.type === 'blob') {
      const bytes = await backend.readBlob(e.oid)
      if (e.mode === '120000') {
        fs.symlinkSync(bytes.toString(), path)
      } else {
        fs.writeFileSync(path, bytes)
        if (e.mode === '100755') fs.chmodSync(path, 0o755)
      }
      count.files++
    }
  }
}
