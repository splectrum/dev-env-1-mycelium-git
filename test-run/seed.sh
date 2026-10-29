#!/bin/sh
# Seed a test-run instance repository, with repo/seed (mycelium-repo).
#   test-run/seed.sh <new-repo-dir> [request-dir]...
# Run from the dev repository's root, from a committed state. Creates:
#   main             a readme only (the instance's own data starts empty)
#   capability/test  every module (mycelium-*) and the run machinery
#   pending/default  a request per tests file (test/commands*.txt) of each module,
#                    then the given request dirs (e.g. test-run/requests/report-runs)
#   execute/main     from main
# as a bare repository (no working tree), with the kick hooks/execute, which
# runs execute.js as deployed.
# The machinery comes from its pinned version: see deploy.sh.
set -eu
dir=$1
shift
src=$(pwd)
[ -e "$dir" ] && { echo "exists: $dir" >&2; exit 2; }
[ -z "$(git -C "$src" status --porcelain)" ] || { echo "dev tree has uncommitted changes; commit first" >&2; exit 2; }
source_commit=$(git -C "$src" rev-parse --short HEAD)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

# The template (repo/seed): main with a readme, and pending/default with a
# request per tests file (test/commands.txt is test-<module>,
# test/commands-<variant>.txt is test-<module>-<variant>) and the given ones.
t=$stage/template
mkdir -p "$t/main" "$t/pending/default/pending"
printf '# Test-run instance\n\nSeeded from dev repository commit %s.\n' "$source_commit" > "$t/main/readme.md"
for tests in $(cd "$src" && ls mycelium-*/test/commands*.txt); do
  module=${tests%%/*}
  variant=$(basename "$tests" .txt | sed -n 's/^commands-//p')
  name=test-$module${variant:+-$variant}
  mkdir "$t/pending/default/pending/$name"
  printf '# Request: %s\n\nRun %s.\n\nRun: %s in %s\n' "$name" "$tests" "$tests" "$module" \
    > "$t/pending/default/pending/$name/request.md"
done
for req in "$@"; do cp -r "$src/$req" "$t/pending/default/pending/$(basename "$req")"; done

# Seeded (main, pending/default, execute/main), then the capability layer
# deployed.
node --input-type=module -e "
import { seed } from '$src/mycelium-repo/index.js'
import { nativeBackend } from '$src/mycelium-git/index.js'
const [dir, template, source] = process.argv.slice(1)
await seed({ backend: nativeBackend(dir), template, source,
  author: { name: 'test-run', email: 'test-run@localhost' } })" "$dir" "$t" "dev commit $source_commit"
"$src/test-run/deploy.sh" "$dir" >/dev/null

# The kick, as deployed: every instance carries its own.
git -C "$dir" show capability/test:hook.sh > "$dir/hooks/execute"
chmod +x "$dir/hooks/execute"
echo "seeded $dir"
