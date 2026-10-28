# test-run

A first, hand-made test run: seed an instance repository, deploy a module
into it and let the instance execute its pending request itself. It's
what `repo/seed`, `layer/deploy` and `layer/request` will become.

```sh
test-run/seed.sh /tmp/runs/r1 mycelium-uri   # from the dev repo's root
/tmp/runs/r1/.git/hooks/execute               # the execution hook
```

- `seed.sh` creates the instance: `main` (README only), `capability/test`
  (the module plus `runner.js` and `execute.js`), `pending/default` (the
  request), `execute/main`, and the hook `.git/hooks/execute`.
- `execute.js`, the execution hook, runs from the deployed tree. For each
  request on `pending/default` with no response on `main` yet:
  1. It extracts `capability/test` and runs the request's tests file
     through the runner.
  2. It commits the results to `pending/default`, under
     `pending/<request>/runs/<run>/`.
  3. It commits the response on `execute/main` and merges it into `main`
     with a plain merge.
- `runner.js` reads tests line by line (`<expect> <command> <arg>...`),
  runs each without a shell and writes one JSON line per test.

Requests that test the run machinery itself are in `requests/`: a run
that must fail (`fail-on-purpose`) and one whose runner cannot complete
(`broken-request`). Add them when seeding:

```sh
test-run/seed.sh /tmp/runs/r2 mycelium-uri test-mycelium-uri \
  test-run/requests/fail-on-purpose test-run/requests/broken-request
```

A run's verdict is `pass` when all tests passed, `fail` when tests ran and
some failed, and `error` when the runner did not complete.

A request names its tests in a `Run:` line:
`Run: mycelium-uri/test/commands.txt in mycelium-uri`. A tests file under
`pending/` is read from the request itself, on `pending/default`.
