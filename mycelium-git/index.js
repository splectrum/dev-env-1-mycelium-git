// mycelium-git — the repository rules over a backend contract.
// Reading a repository by path, from the branch root; writing changes and
// plain merges under the rules.

export { nativeBackend } from './lib/native.js'
export { openRepo, pinned } from './lib/repo.js'
export { writer } from './lib/write.js'
