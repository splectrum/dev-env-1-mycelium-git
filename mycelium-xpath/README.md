# mycelium-xpath

Navigate a tree by path. Generic: it knows no git. A tree is reached only
through `children(node)`, which returns a node's children as
`[name, child]` pairs, or `null` for a leaf. It may be async, as reading a
git tree is.

Paths are `/`-separated from the root, and valid: they are validated at
the boundary (`mycelium-uri`), not here. A `*` step matches every child.

## API

- `select(children, root, path)` → every node matching `path`, as
  `[path, node]` pairs, in the order `children` gives them. A plain path
  gives zero or one pair; `/main/*/a` matches `a` in every child of `main`
- `objectChildren(node)`: `children` for plain objects. An object is a
  folder; anything else is a leaf

`select` is async. Plain, pure functions, not instrumented: a run reproduces
them from their arguments.

## Tests

- `npm test`: the unit tests
- `test/commands.txt`: invocations for a test run, on `test/tree.json`,
  through `cli.js`, each with its expected response
