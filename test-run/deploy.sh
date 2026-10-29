#!/bin/sh
# Deploy into an instance: the capability branch's tree becomes every module
# folder (mycelium-*) and the run machinery, from the dev repository, as one
# commit. Creates the branch if the instance has none yet.
#   test-run/deploy.sh <repo> [capability-branch]   (default: capability/test)
# Run from the dev repository's root, from a committed state.
set -eu
repo=$1
cap=${2:-capability/test}
src=$(pwd)
[ -z "$(git -C "$src" status --porcelain)" ] || { echo "dev tree has uncommitted changes; commit first" >&2; exit 2; }
source_commit=$(git -C "$src" rev-parse --short HEAD)

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp -r "$src"/mycelium-* "$stage/"
cp "$src/test-run/runner.js" "$src/test-run/execute.js" "$src/test-run/report.js" "$stage/"
modules=$(cd "$src" && echo mycelium-*)
commit=$("$src/test-run/commit-dir.sh" "$repo" "$cap" "$stage" . "Deploy into $cap

$modules, runner.js, execute.js and report.js from dev commit $source_commit.")
echo "deployed $cap $(echo "$commit" | cut -c1-7)"
