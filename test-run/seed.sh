#!/bin/sh
# Seed a test-run instance repository, by hand (bootstrap).
#   test-run/seed.sh <new-repo-dir> [request-dir]...
# Run from the dev repository's root, from a committed state. Creates:
#   main             README only (the instance's own data starts empty)
#   capability/test  every module (mycelium-*) and the run machinery
#   pending/default  a request test-<module> per module with test/commands.txt,
#                    then the given request dirs (e.g. test-run/requests/report-runs)
#   execute/main     from main
# and the kick .git/hooks/execute, which runs execute.js as deployed.
set -eu
dir=$1
shift
src=$(pwd)
[ -e "$dir" ] && { echo "exists: $dir" >&2; exit 2; }
[ -z "$(git -C "$src" status --porcelain)" ] || { echo "dev tree has uncommitted changes; commit first" >&2; exit 2; }
source_commit=$(git -C "$src" rev-parse --short HEAD)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

git init -q -b main "$dir"
mkdir "$stage/main"
printf '# Test-run instance\n\nSeeded from dev repository commit %s.\n' "$source_commit" > "$stage/main/README.md"
"$src/test-run/commit-dir.sh" "$dir" main "$stage/main" . "Seed test-run instance

Bootstrap by hand from dev commit $source_commit." >/dev/null

"$src/test-run/deploy.sh" "$dir" >/dev/null

for module in $(cd "$src" && ls -d mycelium-*); do
  [ -f "$src/$module/test/commands.txt" ] || continue
  mkdir "$stage/test-$module"
  printf '# Request: test-%s\n\nRun the test commands of %s.\n\nRun: %s/test/commands.txt in %s\n' \
    "$module" "$module" "$module" "$module" > "$stage/test-$module/request.md"
  "$src/test-run/request.sh" "$dir" "$stage/test-$module" >/dev/null
done
for req in "$@"; do "$src/test-run/request.sh" "$dir" "$src/$req" >/dev/null; done

git -C "$dir" branch execute/main main
git -C "$dir" reset -q --hard
cp "$src/test-run/hook.sh" "$dir/.git/hooks/execute"
chmod +x "$dir/.git/hooks/execute"
echo "seeded $dir"
