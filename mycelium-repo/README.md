# mycelium-repo

Repository capabilities, on mycelium-git: processes on whole repositories
and between them. It never calls git directly.

## repo/publish

`publish({ repo, pkg, product })` publishes a folder package to its product
repository, as `rules.md` describes. It resolves `{ split, copied }`.

1. The folder `pkg` is split out of `main`'s history (`split` in
   mycelium-git: the same commits as `git subtree split`, no `--rejoin`).
2. `publish/<pkg>` is set to the split, forward only: a branch derived
   from `main`, the one exception to disjoint layers.
3. The split is pushed plainly to the product repository's `execute/main`:
   its objects copied (`transfer`), the branch moved forward only. If the
   product's `execute/main` diverged, the push is refused.

`receive({ product, message, author, time })` is the product repository's
side: `execute/main` merged into its `main` with a plain merge, or, on the
first publish, `main` started from it.

The push writes into another repository. That is the rule as written
(publish is a plain push to the product's `execute/main`). It stays
within the boundary the rules give it: only `execute/main`, only forward,
and the product merges into its own `main` itself.

## repo/sync

`sync({ repo, remote })` pushes every branch to another remote, plainly,
and reports divergence, as `{ branch: status }`. Each branch's objects are
copied, then the remote's branch is moved forward only. Anything else is
reported, never forced.

| Status | Meaning | Pushed |
|---|---|---|
| `created` | not on the remote before | yes |
| `advanced` | the remote's branch moved forward to ours | yes |
| `same` | nothing to do | no |
| `remote-ahead` | the remote holds ours plus commits we don't have | no |
| `diverged` | neither holds the other | no |
| `remote-only` | on the remote, not here | no |

For a diverged or remote-ahead branch the objects are still copied, but
nothing refers to them on the remote; garbage collection removes them.

## To come

- repo/seed

## Tests

- `npm test`: the unit tests, on mycelium-git's fixture and empty repositories
- `test/commands.txt`: invocations for a test run, through `cli.js`, across
  engines and on Bare (`bare` on PATH)
