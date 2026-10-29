// repo/sync: every branch pushed to another remote, plainly, and the
// divergence reported. Each branch's objects are copied (transfer), then the
// remote's branch is moved forward only; anything else is reported, never
// forced. The report is { branch: status }:
//   created       not on the remote before
//   advanced      the remote's branch moved forward to ours
//   same          nothing to do
//   remote-ahead  the remote holds ours plus commits we don't have
//   diverged      neither holds the other
//   remote-only   on the remote, not here

import { transfer, writer } from '../../mycelium-git/index.js'

export async function sync ({ repo, remote }) {
  const here = Object.fromEntries(await repo.listBranches())
  const there = Object.fromEntries(await remote.listBranches())
  const w = writer(remote)
  const report = {}
  for (const [branch, head] of Object.entries(here)) {
    await transfer(repo, remote, head)
    const theirs = there[branch]
    if (!theirs) report[branch] = 'created'
    else if (theirs === head) report[branch] = 'same'
    else if (await remote.isAncestor(theirs, head)) report[branch] = 'advanced'
    else if (await remote.isAncestor(head, theirs)) report[branch] = 'remote-ahead'
    else report[branch] = 'diverged'
    if (report[branch] === 'created' || report[branch] === 'advanced') await w.advance(branch, head)
  }
  for (const branch of Object.keys(there)) if (!(branch in here)) report[branch] = 'remote-only'
  return report
}
