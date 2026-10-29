// Copying objects between repositories: everything a commit reaches, from
// one backend into another, whatever their engines. Objects are
// content-addressed, so each arrives under the same oid; one the target
// already has is skipped, with what it reaches (a repository always holds
// the whole history of what it has).

export async function transfer (from, to, commit) {
  const todo = [commit]
  const seen = new Set()
  let copied = 0
  while (todo.length) {
    const oid = todo.pop()
    if (seen.has(oid)) continue
    seen.add(oid)
    if (await to.hasObject(oid)) continue
    const { type, object } = await from.readObject(oid)
    if (type === 'commit') {
      const c = await from.readCommit(oid)
      todo.push(c.tree, ...c.parents)
    } else if (type === 'tree') {
      for (const e of await from.readTree(oid)) if (e.type !== 'commit') todo.push(e.oid)
    }
    const written = await to.writeObject(type, object)
    if (written !== oid) throw new Error(`copied ${oid} arrived as ${written}`)
    copied++
  }
  return copied
}
