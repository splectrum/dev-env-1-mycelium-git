#!/bin/sh
# Inflate a kept run: turn a bundle back into an instance repository, bare
# (no working tree), with all its branches and the kick, hooks/execute.
#   test-run/inflate.sh [--checkout] <bundle> <new-repo-dir>
# --checkout gives the layout of runs kept before instances were bare (r26
# and earlier): a checkout of main, and the kick in .git/hooks/execute.
# Run from the dev repository's root.
set -eu

checkout=
[ "$1" = --checkout ] && { checkout=1; shift; }
bundle=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
dir=$2
src=$(pwd)
[ -e "$dir" ] && { echo "exists: $dir" >&2; exit 2; }

if [ -n "$checkout" ]; then git init -q -b main "$dir"; hooks=$dir/.git/hooks; else git init -q --bare -b main "$dir"; hooks=$dir/hooks; fi
cd "$dir"
git bundle verify -q "$bundle" 2>/dev/null
# Every branch of the bundle becomes a local branch, as it was.
git fetch -q --update-head-ok "$bundle" 'refs/heads/*:refs/heads/*'
[ -n "$checkout" ] && git checkout -q -f main

# The kick as deployed in the instance; runs kept before it was deployed
# get the dev copy.
git show capability/test:hook.sh > "$hooks/execute" 2>/dev/null || cp "$src/test-run/hook.sh" "$hooks/execute"
chmod +x "$hooks/execute"

echo "inflated $dir"
git for-each-ref --format='  %(refname:short) %(objectname:short)' refs/heads
