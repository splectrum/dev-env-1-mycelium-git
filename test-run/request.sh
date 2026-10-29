#!/bin/sh
# Put a request into an instance's pending/default, as one commit, with
# request intake (layer/request, mycelium-layer).
#   test-run/request.sh <repo> <request-dir>
# The request dir (e.g. test-run/requests/report-runs) becomes
# pending/<its name>/; a request already there is refused. Kick the
# instance afterwards.
set -eu
repo=$1
req=$2
src=$(cd "$(dirname "$0")/.." && pwd)
node --input-type=module -e "
import { intake } from '$src/mycelium-layer/index.js'
import { nativeBackend } from '$src/mycelium-git/index.js'
const [repo, folder, name] = process.argv.slice(1)
await intake({ backend: nativeBackend(repo), folder, name,
  author: { name: 'test-run', email: 'test-run@localhost' } })" "$repo" "$req" "$(basename "$req")"
echo "requested $(basename "$req")"
