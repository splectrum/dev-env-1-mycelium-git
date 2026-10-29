// layer/request, execution: the request flow. Each pending request (one on
// pending/default with no response on main yet) is executed on a fixed data
// state and answered on execute/main, which is merged into main with a plain
// merge. The flow records the unit: the invocation, every state it ran on by
// commit (taken before anything changes), the environment and the
// nondeterministic inputs; enough to rerun it.
//
// What a request means is not the flow's: plan chooses and orders the
// requests to execute, and handle executes one.
//   plan([{ name, text }]) → [{ name, line, ... }], in order
//   handle(request, { state, work, out }) → { outcome, body? }
// handle writes its response files into the folder out; outcome says what
// happened, and body, if any, is added to response.md.
//
// The response is main:responses/<name>/: the handler's files, unit.json,
// and response.md. pending/default is not written: it holds the requests.

import fs from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { openRepo, writer } from '../../mycelium-git/index.js'

const byName = requests => [...requests].sort((a, b) => a.name.localeCompare(b.name))

// backend: the repository; capability: the deployed branch the code runs
// from (recorded in the state); environment: recorded in the unit.
// Resolves the names of the requests executed, in order.
export async function executeRequests ({ backend, capability, author, environment = {}, plan = byName, handle }) {
  const now = openRepo(backend)
  const found = async path => (await now.select(path)).length > 0
  const pending = []
  for (const [path] of await now.select('/pending/default/pending/*')) {
    const name = path.split('/').pop()
    if (!await found(`${path}/request.md`) || await found(`/main/responses/${name}`)) continue
    pending.push({ name, text: (await now.read(`${path}/request.md`)).toString() })
  }
  const requests = plan(pending)
  for (const request of requests) await execute(backend, capability, author, environment, handle, request)
  return requests.map(r => r.name)
}

async function execute (backend, capability, author, environment, handle, request) {
  const { name, line } = request
  const runId = new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()
  const started = new Date().toISOString()
  const branches = Object.fromEntries(await backend.listBranches())
  const state = Object.fromEntries(['pending/default', 'main', 'execute/main', capability]
    .map(b => [b, branches[b]]))
  const work = fs.mkdtempSync(join(tmpdir(), 'execute-'))
  const unit = {
    invocation: { request: name, line },
    state,
    environment,
    nondeterministic: { run: runId, started, workDir: work }
  }
  try {
    const out = join(work, 'response')
    fs.mkdirSync(out)
    const { outcome, body } = await handle(request, { state, work, out })
    unit.nondeterministic.finished = new Date().toISOString()
    fs.writeFileSync(join(out, 'unit.json'), JSON.stringify(unit, null, 2) + '\n')
    fs.writeFileSync(join(out, 'response.md'),
      `# Response: ${name}\n\n${outcome}\n\n` +
      `Executed \`${line || '(none)'}\` from \`${capability}\` at \`${state[capability].slice(0, 7)}\`, ` +
      `on \`pending/default\` at \`${state['pending/default'].slice(0, 7)}\` and \`main\` at \`${state.main.slice(0, 7)}\`. ` +
      'The unit record is `unit.json`.\n' + (body ? '\n' + body : ''))

    // Respond on execute/main, synced with main first, then a plain merge
    // into main. The request is referenced by the pending/default commit.
    const ref = `Request: ${state['pending/default'].slice(0, 7)}:pending/${name}/request.md`
    const w = writer(backend)
    await w.merge('main', 'execute/main', 'Merge main into execute/main', { author, fastForward: true })
    const c = await w.change('execute/main')
    for (const file of fs.readdirSync(out)) await c.put(`/responses/${name}/${file}`, fs.readFileSync(join(out, file)))
    await c.commit(`Respond to ${name}\n\n${outcome}\n\n${ref}\n`, { author })
    await w.merge('execute/main', 'main', `Merge execute/main: response to ${name}\n\n${ref}\n`, { author })
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}
