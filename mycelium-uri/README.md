# mycelium-uri

Our URIs: parse, validate, split at known prefixes. Generic: no git, no
dependencies.

A URI is absolute, `/`-separated, with segments of lowercase `a-z`,
`0-9` and `-`; no scheme, query or fragment. Every URI starts with a
branch name, from the root: `/main/x/y`, `/overlay/config/x/y`.

## API

Plain functions, which throw on error:

- `isSegment(s)` → boolean
- `isUri(uri)` → boolean
- `parse(uri)` → segments: `'/a/b'` → `['a', 'b']`, `'/'` → `[]`
- `format(segments)` → uri
- `join(uri, ...parts)` → uri; a part may hold several segments
  (`a/b`), but no empty ones: no `//`, no leading or trailing `/`
- `parent(uri)` → uri; throws for the root
- `split(uri, branches)` → `{ branch, path }`, where `branches` is any
  iterable of branch names. Throws on a branch name that breaks the
  rules, when no branch matches, or when more
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
