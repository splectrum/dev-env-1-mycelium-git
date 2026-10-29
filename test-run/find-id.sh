#!/bin/sh
# Find a module instance by its id: the newest commit whose <folder>/package.json
# carries it. The repository's history is the authoritative record of where
# each instance belongs in the module's evolution.
#   test-run/find-id.sh <folder> <id>
set -eu
folder=$1 id=$2
for c in $(git log --format=%H -- "$folder/package.json"); do
  git show "$c:$folder/package.json" 2>/dev/null | grep -q "\"id\": \"$id\"" && { echo "$c"; exit 0; }
done
echo "no instance $id of $folder" >&2
exit 2
