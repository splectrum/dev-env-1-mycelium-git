#!/bin/sh
# Deploy into an existing instance: replace the tree of its capability branch
# with a module and the run machinery, from the dev repository, as one commit.
#   test-run/deploy.sh <repo> <module> [capability-branch]   (default: capability/test)
# Run from the dev repository's root, from a committed state.
set -eu

repo=$1
module=$2
cap=${3:-capability/test}
src=$(pwd)
[ -z "$(git -C "$src" status --porcelain)" ] || { echo "dev tree has uncommitted changes; commit first" >&2; exit 2; }
source_commit=$(git -C "$src" rev-parse --short HEAD)

export GIT_AUTHOR_NAME="test-run" GIT_AUTHOR_EMAIL="test-run@localhost"
export GIT_COMMITTER_NAME="test-run" GIT_COMMITTER_EMAIL="test-run@localhost"

wt=$(mktemp -d)
rmdir "$wt"
git -C "$repo" worktree add -q "$wt" "$cap"
trap 'git -C "$repo" worktree remove --force "$wt" 2>/dev/null || true' EXIT
git -C "$wt" rm -rq .
cp -r "$src/$module" "$wt/$module"
cp "$src/test-run/runner.js" "$src/test-run/execute.js" "$src/test-run/report.js" "$wt/"
git -C "$wt" add -A
git -C "$wt" commit -q -m "Deploy $module into $cap

$module, runner.js, execute.js and report.js from dev commit $source_commit."
echo "deployed $cap $(git -C "$wt" rev-parse --short HEAD)"
