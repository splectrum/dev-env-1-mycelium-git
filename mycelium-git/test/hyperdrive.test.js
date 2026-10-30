// The contract suite on p2p-git with a Hyperdrive as its filesystem: the
// fixture copied into a drive (on a Corestore of its own), then the same
// tests as on every other engine.

import { after } from 'node:test'
import { existsSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Corestore from 'corestore'
import Hyperdrive from 'hyperdrive'
import { contract } from './contract.js'
import { hyperdriveFs, nativeBackend, p2pgitBackend, transfer } from '../index.js'

const open = []
after(async () => { for (const s of open) await s.close() })

async function onHyperdrive (dir) {
  const store = new Corestore(mkdtempSync(join(tmpdir(), 'corestore-')))
  open.push(store)
  const drive = new Hyperdrive(store)
  await drive.ready()
  const backend = p2pgitBackend('/', { fs: hyperdriveFs(drive) })
  if (existsSync(join(dir, 'HEAD'))) {
    // A fixture on disk: copied into the drive, objects and branches.
    await backend.init()
    const fixture = nativeBackend(dir)
    for (const [name, commit] of await fixture.listBranches()) {
      await transfer(fixture, backend, commit)
      await backend.updateBranch(name, commit, null)
    }
  }
  return backend
}

contract('p2p-git on Hyperdrive', onHyperdrive)
