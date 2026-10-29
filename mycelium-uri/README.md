# mycelium-uri

Our URIs: parse, validate, split at known prefixes. Generic: no git, no
dependencies.

A URI is absolute and `/`-separated, with no scheme, query or fragment. A
segment is a name of lowercase `a-z`, `0-9` and `-`, with optional
`.`-separated extensions of the same characters (`request.md`). At this
level a leaf is an object, and its name includes its extension.

URIs are case-insensitive. The canonical form is lowercase; names keep
their own case where they are stored (`README.md`), and a URI in any case
finds them. So no two names in one folder may differ only by case. Every URI starts with a
branch name, from the root: `/main/x/y`, `/overlay/config/x/y`.

## API

Validation is at the boundary: `validate` where a URI comes in. The other
functions work on valid values and don't check again.

- `validate(uri)` → the canonical URI. Fixes accepted deviations and
  throws when the rules are broken. The accepted deviations are uppercase,
  which folds to lowercase, and empty parts: `//` and a trailing `/`;
  `''` is the root. So `validate('/Main//README.md/')` →
  `'/main/readme.md'`. With `{ star: true }` a step
  may also be `*`, for paths that select
- `sameName(name, step)` → boolean: is a stored name the one a canonical
  step names (case-insensitive). For the boundary only: it finds the
  stored names of an external URI once; inside, stored names match exactly
- `isUri(uri)` → boolean: is it a canonical URI
- `isSegment(s)` → boolean
- `parse(uri)` → segments: `'/a/b'` → `['a', 'b']`, `'/'` → `[]`. Strict:
  it throws on anything not canonical, naming the canonical form
- `format(segments)` → uri
- `join(uri, ...parts)` → uri; a part may hold several segments (`a/b`)
- `parent(uri)` → uri; throws for the root
- `split(uri, branches)` → `{ branch, path }`, where `branches` is any
  iterable of branch names. Throws when no branch matches, or when more
  than one does (the rule that no name is both a branch and a prefix is
  broken)

## Not instrumented

The functions are pure: their result depends only on their arguments. A
run records the invocation of the unit they are part of, and a rerun
reproduces every call inside it.

## Tests

- `npm test`: the unit tests
- `test/commands.txt`: commands for a test run (`<expect> <command>`),
  most through `cli.js`, which
  prints the outcome as one JSON line
