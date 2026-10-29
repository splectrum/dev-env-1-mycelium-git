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

## layer/extract

`extract({ backend, layer, path, folder, source })` extracts a layer, or a
folder in it (`path`, default `/`), to a folder on disk as a folder
package. The folder must not exist yet. Files get their mode back as git
records it: executable, symbolic link, or plain.

The provenance (`source` if given, `layer`, `path`, `commit`, `tree`,
`files`) is the result, and is written beside the folder as
`<folder>.provenance.json`. Beside, not inside, so the folder is exactly
the tree: deployed again, it gives the same tree.

## layer/request: intake

`intake({ backend, folder, name, author, time })` takes a request into
`pending/default`, as `pending/<name>/`, in one commit (`Add request:
<name>`). The request is a folder on disk, and its files go in as they
are. A request already there is refused, because requests are only added.
It resolves `{ commit, files }`.

`test-run/request.sh` puts requests into instances with it.

## layer/request: execution

`executeRequests({ backend, capability, author, environment, plan, handle })`
is the request flow. Each pending request (one on `pending/default` with no
response on `main` yet) is executed on a fixed data state and answered on
`execute/main`, which is merged into `main` with a plain merge. It resolves
the names of the requests executed, in order.

- The unit is recorded as `unit.json`: the invocation, every state it ran
  on by commit (taken before anything changes), the `environment` given,
  and the nondeterministic inputs (run id, times, work folder). That's
  enough to rerun it.
- What a request means is not the flow's. `plan([{ name, text }])` chooses
  and orders the requests (by default, all, by name), and
  `handle(request, { state, work, out })` executes one. It writes its
  response files into `out` and resolves `{ outcome, body }`.
- The response is `main:responses/<name>/`: the handler's files,
  `unit.json` and `response.md`. `pending/default` is not written, since it
  holds the requests.

`test-run/execute.js` runs test runs with it, adding the test-run
specifics: `Run:` and `Report:` requests, runs before reports, and the
runner and the report as handlers.

## layer/export

`exportLayer({ backend, layer, file })` makes a layer available to others
as a bundle file: the layer with its history, self-contained, with no
prerequisites. It resolves `{ commit, bytes }`.

`importBundle({ backend, file, branch, as })` is the receiving
repository's side: the bundle's objects are read in, and the layer is
taken in under the layer rules (`importLayer`). `branch` is needed only
when the bundle holds more than one. Nobody writes into another
repository: one side writes a file, the other takes it in.

Bundles are read and written by mycelium-git (`writeBundle`,
`readBundle`), on every engine.

## Tests

- `npm test`: the unit tests, on mycelium-git's fixture
- `test/commands.txt`: invocations for a test run, through `cli.js`, on
  two fixture repositories, across engines and on Bare (`bare` on PATH)

On Bare, the `process`, `fs` and `path` aliases (`bare-node-*`) are this
package's own dependencies, since Bare resolves built-ins from the
importing package.
