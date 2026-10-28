#!/bin/sh
# Seed a test-run instance repository, by hand (bootstrap).
#   test-run/seed.sh <new-repo-dir> <module> [request-name] [extra-request-dir]...
# Extra request dirs (e.g. test-run/requests/fail-on-purpose) are added to
# pending/default as they are, next to the module's own request.
# Run from the dev repository's root. Creates an empty git repo with:
#   main             README only (the instance's own data starts empty)
#   capability/test  orphan: <module>/, runner.js, execute.js, report.js (the deployment)
#   pending/default  orphan: pending/<request>/request.md
#   execute/main     from main
# and the execution hook .git/hooks/execute, which runs execute.js as
# deployed on capability/test:  <new-repo-dir>/.git/hooks/execute
set -eu

dir=$1
module=$2
name=${3:-test-$module}
src=$(pwd)
shift $(( $# < 3 ? $# : 3 ))
[ -d "$src/$module" ] || { echo "no module folder: $module" >&2; exit 2; }
[ -e "$dir" ] && { echo "exists: $dir" >&2; exit 2; }
# A run must be traceable to an exact commit: refuse uncommitted changes.
[ -z "$(git -C "$src" status --porcelain)" ] || { echo "dev tree has uncommitted changes; commit first" >&2; exit 2; }
source_commit=$(git -C "$src" rev-parse --short HEAD)

export GIT_AUTHOR_NAME="test-run" GIT_AUTHOR_EMAIL="test-run@localhost"
export GIT_COMMITTER_NAME="test-run" GIT_COMMITTER_EMAIL="test-run@localhost"

git init -q -b main "$dir"
cd "$dir"
git config advice.detachedHead false

# main
printf '# Test-run instance\n\nSeeded from dev repository commit %s to test %s.\n' \
  "$source_commit" "$module" > README.md
git add README.md
git commit -q -m "Seed test-run instance

Bootstrap by hand from dev commit $source_commit."

# capability/test: deploy the module and the runner
git checkout -q --orphan capability/test
git rm -rq --cached .
rm -f README.md
cp -r "$src/$module" "$module"
cp "$src/test-run/runner.js" "$src/test-run/execute.js" "$src/test-run/report.js" .
git add .
git commit -q -m "Deploy $module into capability/test

Bootstrap by hand: $module, runner.js and execute.js from dev commit $source_commit."

# pending/default: the request
git checkout -q --orphan pending/default
git rm -rq --cached .
git clean -fdq
mkdir -p "pending/$name"
cat > "pending/$name/request.md" <<REQ
# Request: $name

Run the test commands of $module on capability/test.

Run: $module/test/commands.txt in $module
REQ
for extra in "$@"; do cp -r "$src/$extra" "pending/$(basename "$extra")"; done
git add .
git commit -q -m "Add request: $name"

# execute/main from main; leave main checked out
git checkout -q main
git branch execute/main main

# The execution hook: runs execute.js from the deployed capability branch.
cp "$src/test-run/hook.sh" .git/hooks/execute
chmod +x .git/hooks/execute

echo "seeded $dir"
echo "execute: $dir/.git/hooks/execute"
