#!/bin/bash
# Remove only our install-owned symlinks; preserve any unrelated /usr/bin/amoeba or /usr/bin/orca-ide.
set -e

# RPM passes an instance count; dpkg passes the package lifecycle action.
case "${1-}" in
  0 | remove | purge) ;;
  *) exit 0 ;;
esac

link="/usr/bin/amoeba"

if [ -L "$link" ]; then
  target="$(readlink "$link" || true)"
  case "$target" in
    /opt/Amoeba/*|/opt/orca-ide/*|/opt/orca/*)
      rm -f "$link"
      ;;
  esac
fi

legacy_link="/usr/bin/orca-ide"

if [ -L "$legacy_link" ] && [ "$(readlink "$legacy_link" || true)" = "/opt/Amoeba/resources/bin/orca-ide" ]; then
  rm -f "$legacy_link"
fi

exit 0
