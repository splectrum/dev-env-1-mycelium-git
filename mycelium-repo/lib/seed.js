// repo/seed: a new repository created from a seed template. The template is
// a folder laid out as the repository seen as one tree: main/ is the branch
// main, and each <segment>/<name>/ under another reserved segment is the
// branch <segment>/<name> (pending/default/, overlay/config/, ...). Each
// becomes a layer with one seed commit; then execute/main is created from
// main. The repository must be new: it is initialised here.

import fs from 'node:fs'
import { join } from 'node:path'
import { writer } from '../../mycelium-git/index.js'
import { deploy } from '../../mycelium-layer/index.js'

// backend: of the repository to create (any engine); template: a folder on
// disk; source: named in the seed commits. Resolves { branch: commit }.
export async function seed ({ backend, template, source, author, time }) {
  await backend.init()
  if ((await backend.listBranches()).length) throw new Error('not a new repository')
  const branches = templateBranches(template)
  if (!branches.main) throw new Error(`no main in template: ${template}`)
  const seeded = {}
  for (const [branch, folder] of Object.entries(branches)) {
    const message = `Seed ${branch}${source ? ` from ${source}` : ''}`
    seeded[branch] = (await deploy({ backend, layer: branch, folder, message, author, time })).commit
  }
  seeded['execute/main'] = await writer(backend).createExecution('main')
  return seeded
}

// The branches a template lays out: { branch: folder }, main first.
function templateBranches (template) {
  const out = {}
  const dirs = dir => fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
  for (const segment of dirs(template)) {
    if (segment === 'main') out.main = join(template, 'main')
    else for (const name of dirs(join(template, segment))) out[`${segment}/${name}`] = join(template, segment, name)
  }
  return out
}
