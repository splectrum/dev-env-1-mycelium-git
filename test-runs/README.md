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
| `2026-10-29-r13.bundle` | mycelium-xpath with `select` only: 44 of 44 met |
| `2026-10-29-r14.bundle` | mycelium-git reading a repository as one tree on native git, with uri and xpath; machinery pinned at `673120a`: 62 of 62 met |
| `2026-10-29-r15.bundle` | Machinery deployed from validated version `ee55ef63-87ce-4e11-a746-a627df2649cb` (a GUID, not a commit): 62 of 62 met |
| `2026-10-29-r16.bundle` | URI segments with file extensions; mycelium-git reads `request.md` by URI: 66 of 66 met |
| `2026-10-29-r17.bundle` | Case-insensitive URIs, names kept as stored (`README.md`): 72 of 72 met |
| `2026-10-29-r18.bundle` | Case-insensitive lookup only at the boundary (`sameName`), exact names inside: 72 of 72 met |
| `2026-10-29-r19.bundle` | Modules and machinery by id, no versions; the deployment lists the ids and carries the kick: 72 of 72 met |
| `2026-10-29-r20.bundle` | All requests with the pinned machinery `ee55ef63`, as the reference for r21 |
| `2026-10-29-r21.bundle` | The same with the machinery in development, reading through mycelium-git: identical report and records; validated as `015f3ca2-42cb-4250-8eda-98a7a0be68f8` |
| `2026-10-29-r22.bundle` | Machinery pinned at `015f3ca2-42cb-4250-8eda-98a7a0be68f8`, found by its id: 72 of 72 met |
| `2026-10-29-r23.bundle` | All requests with the pinned machinery `015f3ca2-42cb-4250-8eda-98a7a0be68f8`, as the reference for r24 |
| `2026-10-29-r24.bundle` | The same with the machinery writing through mycelium-git: identical report, records, files and history shape; validated as `f028269b-3f7d-4332-b726-6b7b72a3b930` |
| `2026-10-29-r25.bundle` | Machinery pinned at `f028269b-3f7d-4332-b726-6b7b72a3b930`, mycelium-git with its write slice: all met |
| `2026-10-29-r26.bundle` | All names inside lowercase, files included; new ids for mycelium-uri and mycelium-git: 92 of 92 met |
| `2026-10-29-r27.bundle` | The first bare instance (no working tree), machinery in development: identical to r26 in report, records, files and history |
| `2026-10-29-r28.bundle` | Bare instance, machinery pinned at `90ea965c-8ab2-4d17-a8c6-6687e4132702`: all met; inflated bare and asked again |
| `2026-10-29-r29.bundle` | mycelium-git on native git and isomorphic-git: the same 41 invocations and expectations on each, 133 of 133 met. Carries isomorphic-git and its dependencies |
| `2026-10-29-r30.bundle` | Four engine and runtime combinations (native and isomorphic-git, on Node and on Bare), pinned machinery: the reference for r31 |
| `2026-10-29-r31.bundle` | The same with the machinery recording the Bare version: identical; validated as `7afe7327-3cdc-4834-a4ff-640056b483be` |
| `2026-10-29-r32.bundle` | Machinery pinned at `7afe7327-3cdc-4834-a4ff-640056b483be`: 215 of 215 met |
| `2026-10-29-r33.bundle` | mycelium-git on three engines (native, isomorphic-git, p2p-git), each on Node and on Bare: the same 41 invocations met on all six |
| `2026-10-29-pin-check.bundle` | The check run after the machinery was first pinned (by commit, `673120a`): all met |
| `2026-10-29-r11-redeploy.bundle` | r11 inflated and given a second deploy into `capability/test` |
| `2026-10-29-r28-asked.bundle` | r28 inflated as a bare instance and asked for a report again (`report-again`), executed by the run itself |
| `2026-10-29-r34.bundle` | mycelium-git branch and layer rules (create layer, execution branch, delete once merged) on three engines, on Node and Bare: all met |
| `2026-10-29-r35.bundle` | layer/import (mycelium-layer) across engines and on Bare; mycelium-git transfer and importLayer: all met |
| `2026-10-29-r36.bundle` | repo/publish (mycelium-repo) with split on the backend contract, across engines and on Bare: all met |
| `2026-10-29-r37.bundle` | repo/sync (mycelium-repo): every status, across engines and on Bare: all met |
| `2026-10-29-r38.bundle` | The first instance deployed with layer/deploy (deploy.sh on mycelium-layer); deploy tests on every engine and on Bare: all met |
| `2026-10-29-r39.bundle` | layer/extract (mycelium-layer), the round trip extract then deploy, on every engine and on Bare: all met |
| `2026-10-29-r40.bundle` | The first instance seeded with repo/seed (seed.sh on mycelium-repo); seed tests on every engine and on Bare: all met |
| `2026-10-29-r41.bundle` | Request intake (mycelium-layer) on every engine and on Bare; request.sh on it: all met |
| `2026-10-29-r40-asked.bundle` | r40 inflated, a report request put in with request.sh on request intake (a second one refused), executed by the run itself |
| `2026-10-29-r42.bundle` | layer/export and bundles on the backend contract (mycelium-git writeBundle, readBundle) across engines and on Bare: all met |
| `2026-10-29-r43.bundle` | All requests, self-tests included, with the pinned machinery: the reference for r44 |
| `2026-10-29-r44.bundle` | The same with the request flow as layer/request's executeRequests: identical report, records, files and history; validated as `46ba2e65-5221-43f2-96cd-6dec6c82d35c` |
| `2026-10-29-r45.bundle` | Machinery pinned at `46ba2e65-5221-43f2-96cd-6dec6c82d35c`: all met |
| `2026-10-30-r46.bundle` | Deployment without development dependencies (no Hyperdrive, Corestore or rocksdb-native in the instance), after p2p-git on Hyperdrive: all met |
