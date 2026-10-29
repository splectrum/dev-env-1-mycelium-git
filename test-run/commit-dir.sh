#!/bin/sh
# Commit a folder into a branch, without a worktree.
#   commit-dir.sh <repo> <branch> <dir> <path> <message>
# The folder's contents become <path> in the branch's tree ('.' for the whole
# tree), replacing what was there; the rest of the tree is kept. A missing
# branch is created as an orphan. The ref moves only if it still points where
# it did (compare-and-swap): history only grows, nothing is forced.
set -eu
repo=$1 branch=$2 dir=$3 path=$4 message=$5

export GIT_AUTHOR_NAME="test-run" GIT_AUTHOR_EMAIL="test-run@localhost"
export GIT_COMMITTER_NAME="test-run" GIT_COMMITTER_EMAIL="test-run@localhost"
idx=$(mktemp -u)
trap 'rm -f "$idx"' EXIT
g() { GIT_INDEX_FILE=$idx git -C "$repo" "$@"; }

parent=$(git -C "$repo" rev-parse -q --verify "refs/heads/$branch" || true)
# The folder as a tree.
g --work-tree="$dir" add -A .
tree=$(g write-tree)
rm -f "$idx"
# Put it at <path> in the branch's tree.
if [ "$path" != "." ]; then
  [ -n "$parent" ] && g read-tree "$parent"
  g rm -rq --cached --ignore-unmatch "$path"
  g read-tree --prefix="$path/" "$tree"
  tree=$(g write-tree)
fi
commit=$(git -C "$repo" commit-tree "$tree" ${parent:+-p "$parent"} -m "$message")
git -C "$repo" update-ref "refs/heads/$branch" "$commit" "${parent:-0000000000000000000000000000000000000000}"
echo "$commit"
