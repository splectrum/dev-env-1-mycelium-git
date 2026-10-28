# Kept runs

Kept as data. Each bundle is the full, self-contained record of a test-run instance
repository. Inflate one with `test-run/inflate.sh <bundle> <dir>`, or clone
it (`git clone <bundle> <dir>`) to browse it.

| Bundle | What it records |
|---|---|
| `2026-10-27-r1.bundle` | First run: mycelium-uri, 25/25 passed |
| `2026-10-28-r2.bundle` | Failing run: the hook crash on a missing tests file, the fix deployed into `capability/test` by hand, then pass, fail and error |
| `2026-10-28-r3.bundle` | The fixes checked on a fresh instance |
| `2026-10-28-r4.bundle` | Seeded with the self-test requests: pass, fail and error. Seeded from uncommitted changes on top of `2ad897f` |
| `2026-10-28-r5.bundle` | The same, seeded from committed dev state `d8c969d` |
| `2026-10-28-r5-report.bundle` | r5 inflated, the report capability deployed, and a `Report: runs` request executed by the run itself |
| `2026-10-28-r6.bundle` | mycelium-uri without instrumentation; each run records its unit: invocation, states by commit, environment, nondeterministic inputs |
