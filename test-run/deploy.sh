#!/bin/sh
# Deploy into an instance: the capability branch's tree becomes every module
# folder (mycelium-*), from the dev repository's current commit, and the run
# machinery, from its pinned validated version, as one commit. Creates the
# branch if the instance has none yet.
#   test-run/deploy.sh <repo> [capability-branch]   (default: capability/test)
# Run from the dev repository's root, from a committed state.
# The machinery version is the commit in test-run/machinery; MACHINERY=<commit>
# overrides it, e.g. MACHINERY=HEAD to test new machinery.
set -eu
repo=$1
cap=${2:-capability/test}
src=$(pwd)
[ -z "$(git -C "$src" status --porcelain)" ] || { echo "dev tree has uncommitted changes; commit first" >&2; exit 2; }
source_commit=$(git -C "$src" rev-parse --short HEAD)
machinery=$(git -C "$src" rev-parse --short "${MACHINERY:-$(cat "$src/test-run/machinery")}")

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp -r "$src"/mycelium-* "$stage/"
git -C "$src" archive "$machinery" test-run/runner.js test-run/execute.js test-run/report.js |
  tar -x -C "$stage" --strip-components=1
modules=$(cd "$src" && echo mycelium-*)
commit=$("$src/test-run/commit-dir.sh" "$repo" "$cap" "$stage" . "Deploy into $cap

$modules from dev commit $source_commit; runner.js, execute.js and
report.js from dev commit $machinery (machinery).")
echo "deployed $cap $(echo "$commit" | cut -c1-7)"
