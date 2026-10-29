#!/bin/sh
# The kick: run the pending requests with the deployed machinery.
#   <repo>/hooks/execute [capability-branch]   (default: capability/test)
# Extracts the deployed tree and runs its execute.js, which uses the modules
# deployed next to it. The repository is the one this kick sits in: a bare
# repository (no working tree), or, for runs kept before instances were
# bare, the top of a checkout. Hooks are not part of a bundle:
# seed.sh and inflate.sh install the kick from the deployed tree.
set -eu
repo=$(cd "$(dirname "$0")/.." && pwd)
[ "$(basename "$repo")" = .git ] && repo=$(dirname "$repo")
cap=${1:-capability/test}
code=$(mktemp -d)
trap 'rm -rf "$code"' EXIT
git -C "$repo" archive "$cap" | tar -x -C "$code"
node "$code/execute.js" "$repo" "$cap"
