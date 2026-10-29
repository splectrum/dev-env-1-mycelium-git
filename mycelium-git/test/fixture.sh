#!/bin/sh
# Build the test repository: fixed authors and dates, so its oids are stable.
#   sh test/fixture.sh <dir>
set -eu
dir=$1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@localhost
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@localhost
export GIT_AUTHOR_DATE='2026-01-01T00:00:00Z' GIT_COMMITTER_DATE='2026-01-01T00:00:00Z'
rm -rf "$dir"
git init -q --bare -b main "$dir"
cd "$dir"
blob() { printf '%s' "$1" | git hash-object -w --stdin; }
docs=$(printf '100644 blob %s\ta\n100644 blob %s\tb\n' "$(blob A)" "$(blob B)" | git mktree)
main=$(printf '100644 blob %s\treadme\n100644 blob %s\tREADME.md\n040000 tree %s\tdocs\n' "$(blob hello)" "$(blob convention)" "$docs" | git mktree)
first=$(git commit-tree "$main" -m main)
git update-ref refs/heads/main "$first"
git update-ref refs/heads/execute/main "$first"
r1=$(printf '100644 blob %s\trequest.md\n' "$(blob '# Request: r1')" | git mktree)
pend=$(printf '040000 tree %s\tr1\n' "$r1" | git mktree)
top=$(printf '040000 tree %s\tpending\n' "$pend" | git mktree)
git update-ref refs/heads/pending/default "$(git commit-tree "$top" -m pending)"
cdocs=$(printf '100644 blob %s\ta\n' "$(blob conf)" | git mktree)
conf=$(printf '040000 tree %s\tdocs\n' "$cdocs" | git mktree)
git update-ref refs/heads/overlay/config "$(git commit-tree "$conf" -m config)"
