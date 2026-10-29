#!/bin/sh
# Deploy into an instance: the capability branch's tree becomes every module
# folder (mycelium-*), from the dev repository's current commit, and the run
# machinery, from its pinned validated version, as one commit. Creates the
# branch if the instance has none yet.
#   test-run/deploy.sh <repo> [capability-branch]   (default: capability/test)
# Run from the dev repository's root, from a committed state.
# The machinery is a validated version, test-run/versions/<id>/, by the id in
# test-run/machinery. MACHINERY=<id> overrides it; MACHINERY=dev deploys the
# machinery in development (test-run/) to test it.
set -eu
repo=$1
cap=${2:-capability/test}
src=$(pwd)
[ -z "$(git -C "$src" status --porcelain)" ] || { echo "dev tree has uncommitted changes; commit first" >&2; exit 2; }
source_commit=$(git -C "$src" rev-parse --short HEAD)
machinery=${MACHINERY:-$(cat "$src/test-run/machinery")}
from=$src/test-run/versions/$machinery
[ "$machinery" = dev ] && from=$src/test-run
[ -f "$from/execute.js" ] || { echo "no machinery version: $machinery" >&2; exit 2; }

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp -r "$src"/mycelium-* "$stage/"
cp "$from/runner.js" "$from/execute.js" "$from/report.js" "$stage/"
modules=$(cd "$src" && echo mycelium-*)
commit=$("$src/test-run/commit-dir.sh" "$repo" "$cap" "$stage" . "Deploy into $cap

$modules from dev commit $source_commit; machinery $machinery.")
echo "deployed $cap $(echo "$commit" | cut -c1-7)"
