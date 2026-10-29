# mycelium-layer

Layer capabilities, on mycelium-git: processes in and between
repositories that work with layers. It never calls git directly.

## layer/import

`importLayer({ from, to, branch, as })` takes a layer in from another
repository, with its history. `from` and `to` are backends of any
engines; `as` is the layer's name here (default `branch`). It resolves
`{ commit, copied }`.

The receiving repository does it itself: nobody writes into another
repository. It copies the objects the layer reaches (`transfer`, objects
it already has are skipped), then takes the branch in under the layer
rules (`importLayer` in mycelium-git): a new layer must have an allowed
name and be a leaf, and an existing one only moves forward. Taking in a
layer that has moved on copies only what's new.

## layer/deploy

`deploy({ backend, layer, folder, message, author, time })` deploys a
folder from disk into a layer, as one commit replacing the layer's tree
(`commitTree` in mycelium-git). The message references the source. It
resolves `{ commit, tree, files }`; a missing layer is created first.

The folder is read from the filesystem, so what's installed (dependencies
outside git) is deployed too. Files keep their mode as git records it
(executable, symbolic link, or plain), and empty folders are left out, as
git does. For the same folder it gives the same tree as `git add`, on
every engine. Checked on a real deployment of 2,261 files: native git
13.5 s (one process per file), isomorphic-git and p2p-git about 6 s.

`test-run/deploy.sh` deploys into test-run instances with it.

## To come

- layer/export: making a layer available to others, as a bundle
  (waiting for bundle support)
- layer/extract

## Tests

- `npm test`: the unit tests, on mycelium-git's fixture
- `test/commands.txt`: invocations for a test run, through `cli.js`, on
  two fixture repositories, across engines and on Bare (`bare` on PATH)

On Bare, the `process`, `fs` and `path` aliases (`bare-node-*`) are this
package's own dependencies, since Bare resolves built-ins from the
importing package.
