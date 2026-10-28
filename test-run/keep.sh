#!/bin/sh
# Keep a run: bundle an instance repository, with all its branches, for
# later review. The bundle is the full self-contained record of the run.
#   test-run/keep.sh <repo> <bundle-file>
set -eu
repo=$1
out=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
git -C "$repo" worktree prune
git -C "$repo" bundle create -q "$out" --all
git -C "$repo" bundle verify -q "$out" 2>/dev/null
echo "kept $out"
