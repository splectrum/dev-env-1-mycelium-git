# test-run

A hand-made test run. A test-run repository is kicked into action and
executes its requests; it records what happened and does not judge. A
report request afterwards interprets the record. These scripts are what
`repo/seed`, `layer/deploy` and `layer/request` will become.

```sh
test-run/seed.sh /tmp/runs/r1 test-run/requests/report-runs
/tmp/runs/r1/hooks/execute               # the kick
git -C /tmp/runs/r1 show main:responses/report-runs/report.md
```

- Instances are bare repositories: no working tree, only objects and refs,
  reached through requests.
- `seed.sh` creates the instance with `repo/seed` (mycelium-repo), from a
  template it stages: `main` (a readme only), `capability/test`
  (every module, `mycelium-*`, plus `runner.js`, `execute.js` and
  `report.js`), `pending/default` (a `test-<module>` request per module
  with `test/commands.txt`, then the given request dirs), `execute/main`,
  and the kick
  `hooks/execute`. Git never calls it; it is the trigger, and runs
  `execute.js` as deployed on `capability/test`. Seed only from a
  committed dev state.
- `execute.js` executes each request with no response on `main` yet: Run
  requests first, then Report requests. Each response goes on
  `execute/main`, merged into `main` with a plain merge, as
  `responses/<request>/`:
  - `response.md`: what was executed, on which states, and the outcome.
  - `unit.json`: the unit record. It holds the invocation, every state by
    commit, the environment and the nondeterministic inputs, which is
    enough to rerun it.
  - `results.jsonl` (Run): one line per invocation, with its command,
    exit code and output.
  - `report.md` (Report).

  `pending/default` is never written; it holds the requests.
- Deployments leave out development dependencies (`npm prune --omit=dev`
  on the staged copy).
- `deploy.sh` deploys with `layer/deploy`, and `request.sh` puts a request
  in with request intake (both mycelium-layer). The scripts call our own
  capabilities; none commits with git directly.
- `runner.js` executes a tests file line by line, each command without a
  shell, and records it.
- `report.js` (`Report: runs`) compares every recorded invocation with its
  expectation, read from the tests file at the recorded state.

## Ids, not versions

Every module (`mycelium-*`) and the machinery (`test-run/`) carry an `id`,
a GUID, in their `package.json`. There is no version number: a validated
change gets a new id, and the commit that records it is that instance's
place in the module's evolution. `test-run/find-id.sh <folder> <id>` finds
it. The repository's history is the authoritative record; an id only
names an instance, and choosing a suitable later one is done by reading
that history.

A deployment lists the ids it contains, in its commit message, and the
deployed tree carries every `package.json` (the machinery's as
`machinery.json`). It also carries the kick, so every instance is
self-contained.

The machinery is pinned by the id in `test-run/machinery`. Only the modules
come from the current commit. To change the machinery, develop it in
`test-run/` and run with `MACHINERY=dev`. Once a run validates it, give it
a new id and put that id in `test-run/machinery`.

## Requests

A request names its tests: `Run: mycelium-uri/test/commands.txt in
mycelium-uri`. A tests file under `pending/` is read from the request
itself. A test line is `<command> <arg>... => <expectation>`. The
expectation is the JSON response (the last output line) or `exit <code>`.
It is part of the request; only the report reads it.

`requests/` holds requests that exercise the machinery: `fail-on-purpose`
(expectations not met), `broken-request` (the runner cannot complete) and
`report-runs` (the report).

## Keeping and asking a run

Every run is kept for later review as a bundle, its full self-contained
record: `test-run/keep.sh <repo> <bundle-file>`. Kept runs are data: they
go on the dev repository's `main`, in `test-runs/`, through `execute/main`
like any other change. To ask a kept run something:

```sh
test-run/inflate.sh r7.bundle /tmp/runs/r7     # all branches, plus the kick (--checkout
                                               # for runs kept up to r26)
test-run/deploy.sh /tmp/runs/r7                # only if it needs new capabilities
test-run/request.sh /tmp/runs/r7 <request-dir>
/tmp/runs/r7/hooks/execute
```
