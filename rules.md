# Rules (draft)

## Branches and pending work

- `main` holds settled state. It changes only by plain merges from
  `execute/*`, never by direct commits.
- `pending/default` is always there: an orphan branch, sharing no history
  with `main`, never merged and never deleted. Its tree holds the pending
  requests in `pending/`, with their discussion notes and other data; its
  history is the record of all requests.
- `execute/main` is the execution branch for `main`, from `main`, synced
  with `main` by merging `main` into it before each execution. Execution
  branches are named after their target, `execute/<target>`, which leaves
  room for parallel execution (proposal).
- `publish/<package>` branches (proposal) hold a folder package's history,
  split from `main` with `git subtree split --prefix=<package>`. They are
  derived from `main`, not disjoint: the one exception to disjoint layers.
  A package is published by a plain push of its branch to the product
  repository's `execute/main`, merged into `main` there. No `--rejoin`;
  changes coming back go through `execute/main` like any other.
- `overlay/<name>` branches are overlays on `main`: orphan branches
  mirroring `main`'s paths.
- Further data layers, if needed, are `data/<name>` branches.
- Outcomes are data, in the visible state on `main`: results, notes,
  designs, decisions, kept runs. `pending/default` holds the requests and
  the metadata around producing the visible state, nothing more.
- The response to a request, with its execution record (the unit, its
  results), goes to `execute/*` and from there into `main`. Data from a
  unit in operation belongs to its instance; nothing private goes into
  `pending/default`.

## Layers

- A repository is a composition of disjoint layers. `main`, whose history
  `execute` creates, is one; every other layer branch is its own.
- Layers are never merged into each other, only referenced, and can be
  pulled into other repositories with their history.
- *Layer* is the general term (data layers will come). An *overlay* is a
  layer that shares `main`'s paths. Composing branches into one view is
  left open, to be decided later.
- Proposals, to be tested:
  - A capability branch holds the installed modules: the code as deployed,
    as plain folders. Inside, code calls code directly; there is no
    catalogue.
  - A categorisation by capability URI belongs to external APIs, where a
    requester names what it wants and the name must be mapped to an
    implementation. It is deferred to that level, together with the
    local-scope overlay below.
  - Capability branches are named by purpose, not by library: a
    capability branch is a deployed environment holding the whole
    capability layer. The repository name already carries the phase.
  - Local scope is config, in its own overlay: `overlay/config`, by
    `main`'s paths, referring to capabilities by URI (deferred, with the
    categorisation, to the external API level).
  - A layer is *local* (a branch here), *imported* (fetched here with its
    history), or *virtual* (resolved from another repository at compose
    time, never stored here). Private config is a virtual layer from the
    private instance repository.

## Development and deployment

- One development repository per phase; each package is a folder on
  `main` (here `mycelium-uri/`, `mycelium-xpath/`, `mycelium-git/`).
- The code is developed on `main` as data and deployed as a tree into a
  `capability/<purpose>` branch to operate.
- `capability/default` operates this repository's own functionality.
  `capability/test` is where development deploys and test runs, without
  touching `capability/default`. More test lanes, if needed, are further
  `capability/<purpose>` branches (e.g. `capability/test-isogit`).
- Promotion deploys the tree tested on `capability/test` into
  `capability/default`. The first deployment is a bootstrap by hand.
- Code is tested against every git backend; development may start on
  one (native git, the reference) and add the others.
- Session branches (`claude/…`) are where a cloud session executes until
  told to use `execute/<target>`.
- How branches beyond `main`, `pending/default` and `execute/main` are
  pushed is settled once development is done.

## Commit messages

- First line: the state change.
- Body: the request it answers and why, briefly.
- References to the full details on `pending/default`, with the commit:
  `<commit>:pending/<path>`. The merge into `main` references the
  `pending/default` commit holding the request details.

## Git consequences

- Merges into `main` are plain merges: no squash, no rebase, so execution
  history reaches `main` as it happened.
- No force-push on any branch; history only grows.
- A branch is deleted only after a plain merge: `git branch -d`, never
  `-D`.

## Reserved first segments

A layer branch is named by a reserved first segment; all other branch
names, and all folder names, are free. Current scope; revised as needed.

| Segment | Meaning |
|---|---|
| `main` | The data (the default branch) |
| `pending` | Pending work; also the top folder on `pending/default` |
| `execute` | Execution branches, named after their target |
| `publish` | Packages split from `main` for publishing (proposal) |
| `overlay` | Overlays on `main` |
| `data` | Further data layers |
| `capability` | The installed modules, deployed (proposal) |
| `default` | The permanent branch within a namespace (in `execute`, the target names it) |

## URIs

Scope: branch names and repository folders, wherever XPath is used.

- Every URI starts with a branch name, from the root: `/main/x/y`,
  `/overlay/config/x/y`. The branch part is unambiguous, because a branch
  is always a leaf.
- Relative within a repository: `/`-separated segments; no scheme, query
  or fragment.
- Segments, for branches and folders alike: lowercase `a-z`, `0-9`, `-`.
  Any folder can then become a branch, and the other way round.
- A file's segment includes its extension: a name as above, then
  optional `.`-separated extensions of the same characters
  (`request.md`). At this level a leaf is an object, and its storage
  format is part of its name.
- Inside our repositories every name is lowercase, files included.
  Uppercase names are external (`README.md`, by convention elsewhere).
- URIs are case-insensitive. A URI coming in is validated into its
  canonical, lowercase form and selected; external content keeps its own
  case, and the requester gets the object as stored. That lookup is the
  boundary's process; inside, paths match exactly.
- A name is never both a branch and a prefix.

## Open

- Execution branch prefix: `execute/<target>` (as here) or
  `execution/<target>`.

- Whether history may be rewritten to remove leaked data.
