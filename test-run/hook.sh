#!/bin/sh
# The kick: run the pending requests with the deployed machinery.
#   .git/hooks/execute [capability-branch]   (default: capability/test)
# Extracts the deployed tree and runs its execute.js, which uses the modules
# deployed next to it. Hooks are not part of a bundle: seed.sh and inflate.sh
# install the kick from the deployed tree.
set -eu
repo=$(cd "$(dirname "$0")/../.." && pwd)
cap=${1:-capability/test}
code=$(mktemp -d)
trap 'rm -rf "$code"' EXIT
git -C "$repo" archive "$cap" | tar -x -C "$code"
node "$code/execute.js" "$repo" "$cap"
