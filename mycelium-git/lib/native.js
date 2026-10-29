// Native git backend: the reference. Implements the backend contract over
// git's plumbing.

import { spawn } from 'node:child_process'
import process from 'node:process'

const ZERO = '0000000000000000000000000000000000000000'

export function nativeBackend (dir) {
  // Run git; resolves { code, stdout }. Exit codes in ok are not errors.
  const run = (args, { input, env, ok = [0], buffer = false } = {}) => new Promise((resolve, reject) => {
    const p = spawn('git', args, { cwd: dir, env: { ...process.env, ...env } })
    const out = []
    const err = []
    p.stdout.on('data', d => out.push(d))
    p.stderr.on('data', d => err.push(d))
    p.on('error', reject)
    p.on('close', code => {
      const stdout = Buffer.concat(out)
      if (!ok.includes(code)) {
        return reject(new Error(`git ${args[0]}: ${Buffer.concat(err).toString().trim()}`))
      }
      resolve({ code, stdout: buffer ? stdout : stdout.toString() })
    })
    p.stdin.end(input)
  })
  const git = async (args, opts) => (await run(args, opts)).stdout

  return {
    // --- Reading ---

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
      return git(['cat-file', 'blob', oid], { buffer: true })
    },

    // Raw objects, for copying between repositories: { type, object }.
    async readObject (oid) {
      const type = (await git(['cat-file', '-t', oid])).trim()
      return { type, object: await git(['cat-file', type, oid], { buffer: true }) }
    },

    async hasObject (oid) {
      return (await run(['cat-file', '-e', oid], { ok: [0, 1, 128] })).code === 0
    },

    // --- Writing ---

    async writeObject (type, bytes) {
      return (await git(['hash-object', '-t', type, '-w', '--stdin', '--literally'], { input: bytes })).trim()
    },

    async writeBlob (bytes) {
      return (await git(['hash-object', '-w', '--stdin'], { input: bytes })).trim()
    },

    // entries: { name, mode, type, oid }
    async writeTree (entries) {
      const input = entries.map(e => `${e.mode} ${e.type} ${e.oid}\t${e.name}\0`).join('')
      return (await git(['mktree', '-z'], { input })).trim()
    },

    // author: { name, email }; time: ISO string, or now. A message always
    // ends with a newline, as git's own commits do.
    async writeCommit ({ tree, parents, message, author, time }) {
      if (!message.endsWith('\n')) message += '\n'
      const env = {
        GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email,
        GIT_COMMITTER_NAME: author.name, GIT_COMMITTER_EMAIL: author.email,
        ...(time && { GIT_AUTHOR_DATE: time, GIT_COMMITTER_DATE: time })
      }
      const args = ['commit-tree', tree, ...parents.flatMap(p => ['-p', p]), '-F', '-']
      return (await git(args, { input: message, env })).trim()
    },

    // Move a branch only if it still points at expected (null: must not
    // exist). Compare-and-swap: nothing is forced.
    async updateBranch (name, oid, expected) {
      await git(['update-ref', `refs/heads/${name}`, oid, expected || ZERO])
    },

    // Delete a branch only if it still points at expected.
    async deleteBranch (name, expected) {
      await git(['update-ref', '-d', `refs/heads/${name}`, expected])
    },

    // --- History and merge ---

    // The commit two commits share, or null: unrelated histories.
    async mergeBase (a, b) {
      const { code, stdout } = await run(['merge-base', a, b], { ok: [0, 1] })
      return code === 0 ? stdout.trim() : null
    },

    async isAncestor (a, b) {
      return (await run(['merge-base', '--is-ancestor', a, b], { ok: [0, 1] })).code === 0
    },

    // Merge two commits' trees. Resolves { tree, conflicts: [path] }.
    async mergeTrees (ours, theirs) {
      const { code, stdout } = await run(
        ['merge-tree', '--write-tree', '--name-only', '--no-messages', ours, theirs], { ok: [0, 1] })
      const [tree, ...rest] = stdout.split('\n')
      return { tree, conflicts: code === 0 ? [] : rest.filter(Boolean) }
    }
  }
}
