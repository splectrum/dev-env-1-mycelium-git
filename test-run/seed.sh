#!/bin/sh
# Seed a test-run instance repository, by hand (bootstrap).
#   test-run/seed.sh <new-repo-dir> [request-dir]...
# Run from the dev repository's root, from a committed state. Creates:
#   main             README only (the instance's own data starts empty)
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

git init -q --bare -b main "$dir"
mkdir "$stage/main"
printf '# Test-run instance\n\nSeeded from dev repository commit %s.\n' "$source_commit" > "$stage/main/README.md"
"$src/test-run/commit-dir.sh" "$dir" main "$stage/main" . "Seed test-run instance

Bootstrap by hand from dev commit $source_commit." >/dev/null

"$src/test-run/deploy.sh" "$dir" >/dev/null

# A request per tests file: test/commands.txt is test-<module>,
# test/commands-<variant>.txt is test-<module>-<variant>.
for tests in $(cd "$src" && ls mycelium-*/test/commands*.txt); do
  module=${tests%%/*}
  variant=$(basename "$tests" .txt | sed -n 's/^commands-//p')
  name=test-$module${variant:+-$variant}
  mkdir "$stage/$name"
  printf '# Request: %s\n\nRun %s.\n\nRun: %s in %s\n' "$name" "$tests" "$tests" "$module" > "$stage/$name/request.md"
  "$src/test-run/request.sh" "$dir" "$stage/$name" >/dev/null
done
for req in "$@"; do "$src/test-run/request.sh" "$dir" "$src/$req" >/dev/null; done

git -C "$dir" branch execute/main main
# The kick, as deployed: every instance carries its own.
git -C "$dir" show capability/test:hook.sh > "$dir/hooks/execute"
chmod +x "$dir/hooks/execute"
echo "seeded $dir"
