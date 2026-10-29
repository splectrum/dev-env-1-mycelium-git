// layer/request, intake: a request taken into pending/default, as
// pending/<name>/, in one commit. The request is a folder on disk; its files
// go in as they are. A request that's already there is refused: requests
// are only added. (Executing requests is still the test-run machinery.)

import fs from 'node:fs'
import { join } from 'node:path'
import { openRepo, writer } from '../../mycelium-git/index.js'

// backend: the repository; folder: the request on disk; name: its name in
// pending/ (a valid segment). Resolves { commit, files }.
export async function intake ({ backend, folder, name, author, time }) {
  const files = listFiles(folder)
  if (!files.length) throw new Error(`empty request: ${folder}`)
  if ((await openRepo(backend).select(`/pending/default/pending/${name}`)).length) {
    throw new Error(`request exists: ${name}`)
  }
  const c = await writer(backend).change('pending/default')
  for (const file of files) await c.put(`/pending/${name}/${file}`, fs.readFileSync(join(folder, file)))
  const commit = await c.commit(`Add request: ${name}`, { author, time })
  return { commit, files: files.length }
}

// The files in a folder, as paths relative to it.
function listFiles (dir, at = '') {
  return fs.readdirSync(join(dir, at), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? listFiles(dir, join(at, e.name)) : e.isFile() ? [join(at, e.name)] : [])
}
