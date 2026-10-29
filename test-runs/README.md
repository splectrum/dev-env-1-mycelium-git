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
| `2026-10-28-r7.bundle` | The first run of the new model, seeded from the intermediate 'wip' commit; same outcome as r8 |
| `2026-10-28-r8.bundle` | Execution only records, into each response on `main`; expectations on the test lines; a report request interprets: 26 met, 3 not met on purpose, 1 unchecked, 1 incomplete on purpose |
| `2026-10-28-r9.bundle` | mycelium-uri enforcing the rules in `join` and `split`: 28 of 28 met |
| `2026-10-29-r10.bundle` | mycelium-uri with `validate` at the boundary, fixing empty parts: 32 of 32 met |
| `2026-10-29-r11.bundle` | mycelium-uri and mycelium-xpath deployed together, seeded through the simplified scripts: 46 of 46 met |
| `2026-10-29-r12.bundle` | The same with the self-test requests: 47 met, 3 not met and 1 incomplete on purpose, 1 unchecked |
