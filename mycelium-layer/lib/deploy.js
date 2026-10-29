// layer/deploy: a folder deployed into a layer, as one commit replacing the
// layer's tree and referencing its source in the message. The folder is read
// from the filesystem, so what's installed (dependencies outside git) is
// deployed too. Files keep their mode as git records it: executable,
// symbolic link, or plain. Empty folders are left out, as git does.

import fs from 'node:fs'
import { join } from 'node:path'
import { writer } from '../../mycelium-git/index.js'

// backend: the repository deployed into; layer: the branch (created as a
// layer if missing); folder: on disk. Resolves { commit, tree, files }.
export async function deploy ({ backend, layer, folder, message, author, time }) {
  const count = { files: 0 }
  const tree = await folderTree(backend, folder, count)
  if (!tree) throw new Error(`empty folder: ${folder}`)
  const w = writer(backend)
  if (!Object.fromEntries(await backend.listBranches())[layer]) {
    await w.createLayer(layer, `Create ${layer}`, { author, time })
  }
  const commit = await w.commitTree(layer, tree, message, { author, time })
  return { commit, tree, files: count.files }
}

// The tree of a folder on disk, or null if it holds no files.
async function folderTree (backend, dir, count) {
  const entries = []
  for (const name of fs.readdirSync(dir)) {
    const path = join(dir, name)
    const stat = fs.lstatSync(path)
    if (stat.isSymbolicLink()) {
      entries.push({ name, mode: '120000', type: 'blob', oid: await backend.writeBlob(fs.readlinkSync(path)) })
      count.files++
    } else if (stat.isDirectory()) {
      const oid = await folderTree(backend, path, count)
      if (oid) entries.push({ name, mode: '040000', type: 'tree', oid })
    } else if (stat.isFile()) {
      const mode = stat.mode & 0o100 ? '100755' : '100644'
      entries.push({ name, mode, type: 'blob', oid: await backend.writeBlob(fs.readFileSync(path)) })
      count.files++
    }
  }
  return entries.length ? backend.writeTree(entries) : null
}
