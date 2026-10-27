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
- Request data goes to `pending/default`, the response to `execute/*`.
  Request data includes the execution data of the request: metrics, audit,
  verdicts. Data from a unit in operation belongs to its instance; nothing
  private goes into `pending/default`.

## Layers

- A repository is a composition of disjoint layers. `main`, whose history
  `execute` creates, is one; every other layer branch is its own.
- Layers are never merged into each other, only referenced, and can be
  pulled into other repositories with their history.
- *Layer* is the general term (data layers will come). An *overlay* is a
  layer that shares `main`'s paths. Composing branches into one view is
  left open, to be decided later.
- Proposals, to be tested:
  - Capabilities are global for now: `capability/default` holds the catalogue
    of installed capabilities, by capability URI.
  - Local scope is config, in its own overlay: `overlay/config`, by
    `main`'s paths, referring to capabilities by URI.
  - A layer is *local* (a branch here), *imported* (fetched here with its
    history), or *virtual* (resolved from another repository at compose
    time, never stored here). Private config is a virtual layer from the
    private instance repository.

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
| `capability` | The capability catalogue (proposal) |
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
- A name is never both a branch and a prefix.

## Open

- Whether history may be rewritten to remove leaked data.
