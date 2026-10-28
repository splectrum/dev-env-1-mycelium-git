# test-run

A hand-made test run. A test-run repository is kicked into action and
executes its requests; it records what happened and does not judge. A
report request afterwards interprets the record. These scripts are what
`repo/seed`, `layer/deploy` and `layer/request` will become.

```sh
test-run/seed.sh /tmp/runs/r1 mycelium-uri test-mycelium-uri test-run/requests/report-runs
/tmp/runs/r1/.git/hooks/execute               # the kick
git -C /tmp/runs/r1 show main:responses/report-runs/report.md
```

- `seed.sh` creates the instance: `main` (README only), `capability/test`
  (the module plus `runner.js`, `execute.js` and `report.js`),
  `pending/default` (the requests), `execute/main`, and the kick
  `.git/hooks/execute`. Git never calls it; it is the trigger, and runs
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
- `runner.js` executes a tests file line by line, each command without a
  shell, and records it.
- `report.js` (`Report: runs`) compares every recorded invocation with its
  expectation, read from the tests file at the recorded state.

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
test-run/inflate.sh r7.bundle /tmp/runs/r7     # all branches, plus the kick
test-run/deploy.sh /tmp/runs/r7 mycelium-uri   # only if it needs new capabilities
test-run/request.sh /tmp/runs/r7 <request-dir>
/tmp/runs/r7/.git/hooks/execute
```
