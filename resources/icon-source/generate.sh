#!/bin/bash
# Regenerate Amoeba's app, alternate and tray icons from the amoeba.sh organism shader (macOS only: uses sips and iconutil).
set -euo pipefail
node "$(cd "$(dirname "$0")" && pwd)/generate.mjs"
