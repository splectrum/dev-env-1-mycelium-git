// A Hyperdrive as p2p-git's filesystem: p2p-git's own Hyperdrive adapter
// (hyperdrive-fs.js), with what it lacks for p2p-git. Folders in a
// Hyperdrive have no entries of their own, and the adapter's stat reports
// them as not folders; and p2p-git also needs readlink and symlink.
// (Both are fixes for p2p-git's hyperdrive-fs.js.)
//   p2pgitBackend('/', { fs: hyperdriveFs(drive) })

import { createFs } from 'p2p-git/hyperdrive-fs'

const folder = {
  isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false,
  mode: 0o40755, size: 0, uid: 1, gid: 1, ino: 0, dev: 0, mtimeMs: 0, ctimeMs: 0
}

export function hyperdriveFs (drive) {
  const base = createFs(drive).promises
  const asFolder = stat => async path => {
    const s = await stat(path)
    return s.isFile() || s.isDirectory() || s.isSymbolicLink() ? s : folder
  }
  return {
    promises: {
      ...base,
      stat: asFolder(base.stat),
      lstat: asFolder(base.lstat),
      async readlink (path) {
        const entry = await drive.entry(path)
        if (!entry || !entry.value.linkname) {
          const err = new Error(`ENOENT: no such file or directory, '${path}'`)
          err.code = 'ENOENT'
          throw err
        }
        return entry.value.linkname
      },
      async symlink (target, path) {
        await drive.symlink(path, target)
      }
    }
  }
}
