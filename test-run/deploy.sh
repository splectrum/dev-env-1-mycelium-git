#!/bin/sh
# Deploy into an instance, with layer/deploy (mycelium-layer): the capability
# branch's tree becomes every module
# folder (mycelium-*), from the dev repository's current commit, and the run
# machinery (with the kick, hook.sh, and its package.json as machinery.json),
# from its pinned validated version, as one commit. Creates the
# branch if the instance has none yet.
#   test-run/deploy.sh <repo> [capability-branch]   (default: capability/test)
# Run from the dev repository's root, from a committed state.
# Every module and the machinery carry an id in their package.json; a
# validated change gets a new id. The machinery is pinned by the id in
# test-run/machinery and found in this repository's history (find-id.sh);
# MACHINERY=<id> overrides it, MACHINERY=dev deploys test-run/ as it is.
set -eu
repo=$1
cap=${2:-capability/test}
src=$(pwd)
[ -z "$(git -C "$src" status --porcelain)" ] || { echo "dev tree has uncommitted changes; commit first" >&2; exit 2; }
source_commit=$(git -C "$src" rev-parse --short HEAD)
machinery=${MACHINERY:-$(cat "$src/test-run/machinery")}
from=$(mktemp -d)
if [ "$machinery" = dev ]; then
  cp -r "$src/test-run/." "$from/"
else
  commit=$(cd "$src" && test-run/find-id.sh test-run "$machinery")
  git -C "$src" archive "$commit" test-run | tar -x -C "$from" --strip-components=1
fi
stage=$(mktemp -d)
trap 'rm -rf "$stage" "$from"' EXIT
cp -r "$src"/mycelium-* "$stage/"
cp "$from/runner.js" "$from/execute.js" "$from/report.js" "$from/hook.sh" "$stage/"
cp "$from/package.json" "$stage/machinery.json"
ids() { sed -n 's/.*"id": "\(.*\)".*/\1/p' "$1"; }
modules=$(cd "$stage" && for m in mycelium-*; do echo "$m $(ids "$m/package.json")"; done)
machinery_id=$(ids "$stage/machinery.json")
message="Deploy into $cap

$modules
machinery $machinery_id

From dev commit $source_commit."
# The staged folder deployed as one commit on the layer (layer/deploy).
commit=$(node --input-type=module -e "
import { deploy } from '$src/mycelium-layer/index.js'
import { nativeBackend } from '$src/mycelium-git/index.js'
const [repo, layer, folder, message] = process.argv.slice(1)
const r = await deploy({ backend: nativeBackend(repo), layer, folder, message,
  author: { name: 'test-run', email: 'test-run@localhost' } })
console.log(r.commit)" "$repo" "$cap" "$stage" "$message")
echo "deployed $cap $(echo "$commit" | cut -c1-7)"
