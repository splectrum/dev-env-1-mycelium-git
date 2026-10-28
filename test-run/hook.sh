#!/bin/sh
# Execution hook: run the pending requests with the deployed execute.js.
#   .git/hooks/execute [capability-branch]   (default: capability/test)
# Installed by seed.sh and inflate.sh; hooks are not part of a bundle.
set -eu
repo=$(cd "$(dirname "$0")/../.." && pwd)
cap=${1:-capability/test}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$repo" show "$cap:execute.js" > "$tmp/execute.mjs"
node "$tmp/execute.mjs" "$repo" "$cap"
