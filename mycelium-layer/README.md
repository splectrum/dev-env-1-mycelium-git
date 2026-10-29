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

## To come

- layer/export: making a layer available to others, as a bundle
  (waiting for bundle support)
- layer/deploy, layer/extract

## Tests

- `npm test`: the unit tests, on mycelium-git's fixture
- `test/commands.txt`: invocations for a test run, through `cli.js`, on
  two fixture repositories, across engines and on Bare (`bare` on PATH)

On Bare, the `process` alias (`bare-node-process`) is this package's own
dependency, since Bare resolves built-ins from the importing package.
