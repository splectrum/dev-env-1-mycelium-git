// Write a bundle of all branches with p2p-git's own pieces.
import nodeFs from 'node:fs'
import { FileSystem } from '/home/user/ref/bare-for-pear_p2p-git/src/models/FileSystem.js'
const fs = new FileSystem(nodeFs)
import { _pack } from '/home/user/ref/bare-for-pear_p2p-git/src/commands/pack.js'
import { listObjects } from '/home/user/ref/bare-for-pear_p2p-git/src/commands/listObjects.js'
import * as git from '/home/user/ref/bare-for-pear_p2p-git/src/plumbing.js'
const gitdir = nodeFs.realpathSync(process.argv[2]), out = process.argv[3]
const branches = await git.listBranches({ fs, gitdir })
const heads = await Promise.all(branches.map(async b => [b, await git.resolveRef({ fs, gitdir, ref: `refs/heads/${b}` })]))
const oids = await listObjects({ fs, cache: {}, gitdir, oids: heads.map(([, o]) => o) })
const pack = await _pack({ fs, cache: {}, gitdir, oids: [...oids] })
const header = '# v2 git bundle\n' + heads.map(([b, o]) => `${o} refs/heads/${b}\n`).join('') + '\n'
nodeFs.writeFileSync(out, Buffer.concat([Buffer.from(header), ...pack]))
console.log(heads.length, 'refs,', oids.size, 'objects')
