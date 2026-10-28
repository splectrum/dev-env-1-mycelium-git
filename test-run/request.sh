#!/bin/sh
# Put a request into an instance's pending/default, as one commit.
#   test-run/request.sh <repo> <request-dir>
# The request dir (e.g. test-run/requests/report-runs) is added as
# pending/<its name>/. Run the execution hook afterwards.
set -eu

repo=$1
req=$2
name=$(basename "$req")

export GIT_AUTHOR_NAME="test-run" GIT_AUTHOR_EMAIL="test-run@localhost"
export GIT_COMMITTER_NAME="test-run" GIT_COMMITTER_EMAIL="test-run@localhost"

git -C "$repo" cat-file -e "pending/default:pending/$name" 2>/dev/null && { echo "request exists: $name" >&2; exit 2; }
wt=$(mktemp -d)
rmdir "$wt"
git -C "$repo" worktree add -q "$wt" pending/default
trap 'git -C "$repo" worktree remove --force "$wt" 2>/dev/null || true' EXIT
cp -r "$req" "$wt/pending/$name"
git -C "$wt" add -A
git -C "$wt" commit -q -m "Add request: $name"
echo "requested $name"
