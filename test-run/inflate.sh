#!/bin/sh
# Inflate a kept run: turn a bundle back into a working instance repository,
# with all its branches and the execution hook.
#   test-run/inflate.sh <bundle> <new-repo-dir>
# Run from the dev repository's root.
set -eu

bundle=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
dir=$2
src=$(pwd)
[ -e "$dir" ] && { echo "exists: $dir" >&2; exit 2; }

git init -q -b main "$dir"
cd "$dir"
git bundle verify -q "$bundle" 2>/dev/null
# Every branch of the bundle becomes a local branch, as it was.
git fetch -q --update-head-ok "$bundle" 'refs/heads/*:refs/heads/*'
git checkout -q -f main

cp "$src/test-run/hook.sh" .git/hooks/execute
chmod +x .git/hooks/execute

echo "inflated $dir"
git for-each-ref --format='  %(refname:short) %(objectname:short)' refs/heads
