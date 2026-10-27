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
- `join(uri, ...parts)` → uri; parts may hold `/`
- `parent(uri)` → uri; throws for the root
- `split(uri, branches)` → `{ branch, path }`, where `branches` is any
  iterable of branch names. Throws when no branch matches, or when more
  than one does (the rule that no name is both a branch and a prefix is
  broken)

## Instrumentation

`create({ sink })` returns the same functions, instrumented. Every call
emits one event to `sink`: `{ seq, level: 'uri', op, args, result | error,
ms }`. Values are summarised: bytes by size, long strings by length,
iterables as arrays. `memorySink()` collects events in `sink.events`.

`instrument(fns, { sink, level })` is the wrapper itself. It lives here
for now; it moves to a shared place when a second package needs it.

## Tests

- `npm test`: the unit tests
- `test/commands.txt`: commands for a test run, through `cli.js`, which
  prints the audit events and the outcome as JSON lines
