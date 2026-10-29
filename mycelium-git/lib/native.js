// Native git backend: the reference. Reads through git's plumbing.
// First slice of the backend contract: reading refs, commits, trees, blobs.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export function nativeBackend (dir) {
  const git = async (args, encoding = 'utf8') =>
    (await run('git', args, { cwd: dir, encoding, maxBuffer: 1 << 30 })).stdout

  return {
    // Branches, as [name, commit oid] pairs: 'pending/default', not 'refs/heads/...'.
    async listBranches () {
      const out = await git(['for-each-ref', '--format=%(refname:strip=2) %(objectname)', 'refs/heads'])
      return out.split('\n').filter(Boolean).map(l => l.split(' '))
    },

    async readCommit (oid) {
      const out = await git(['cat-file', 'commit', oid])
      const [head, ...message] = out.split('\n\n')
      const fields = head.split('\n').map(l => [l.slice(0, l.indexOf(' ')), l.slice(l.indexOf(' ') + 1)])
      return {
        tree: fields.find(([k]) => k === 'tree')[1],
        parents: fields.filter(([k]) => k === 'parent').map(([, v]) => v),
        message: message.join('\n\n')
      }
    },

    // A tree's entries: { name, mode, type: 'tree' | 'blob', oid }.
    async readTree (oid) {
      const out = await git(['ls-tree', '-z', oid])
      return out.split('\0').filter(Boolean).map(l => {
        const [meta, name] = l.split('\t')
        const [mode, type, entryOid] = meta.split(' ')
        return { name, mode, type, oid: entryOid }
      })
    },

    async readBlob (oid) {
      return git(['cat-file', 'blob', oid], 'buffer')
    }
  }
}
