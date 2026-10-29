#!/bin/sh
# Put a request into an instance's pending/default, as one commit.
#   test-run/request.sh <repo> <request-dir>
# The request dir (e.g. test-run/requests/report-runs) becomes
# pending/<its name>/. Kick the instance afterwards.
set -eu
repo=$1
req=$2
name=$(basename "$req")
git -C "$repo" cat-file -e "pending/default:pending/$name" 2>/dev/null && { echo "request exists: $name" >&2; exit 2; }
"$(dirname "$0")/commit-dir.sh" "$repo" pending/default "$req" "pending/$name" "Add request: $name" >/dev/null
echo "requested $name"
