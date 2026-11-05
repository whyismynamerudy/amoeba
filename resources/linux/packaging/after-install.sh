#!/bin/bash
# deb/rpm must register amoeba for headless hosts where the in-app installer cannot run.
# The shim resolves the app relative to itself, so a symlink works; discover the install directory
# because electron-builder sanitizes productName.
set -e

link="/usr/bin/amoeba"
# Earlier builds registered orca-ide; only a link into our own install is ours to retire.
legacy_link="/usr/bin/orca-ide"

is_owned_link() {
  [ -L "$link" ] || return 1
  local link_target candidate candidate_target
  link_target="$(readlink -f -- "$link" 2>/dev/null || true)"
  for candidate in /opt/Amoeba/resources/bin/amoeba /opt/orca-ide/resources/bin/amoeba /opt/orca/resources/bin/amoeba; do
    candidate_target="$(readlink -f -- "$candidate" 2>/dev/null || true)"
    if [ -n "$candidate_target" ] && [ "$link_target" = "$candidate_target" ]; then
      return 0
    fi
  done
  return 1
}

for dir in /opt/Amoeba /opt/orca-ide /opt/orca; do
  sandbox="$dir/chrome-sandbox"
  if [ -f "$sandbox" ]; then
    # Why: packaged Linux installs must leave Chromium's sandbox helper usable
    # on hosts where unprivileged user namespaces are unavailable.
    chmod 4755 "$sandbox" || true
  fi

  shim="$dir/resources/bin/amoeba"
  if [ -x "$shim" ]; then
    # Only manage our own symlink; never clobber an unrelated /usr/bin/amoeba.
    if { [ ! -e "$link" ] && [ ! -L "$link" ]; } || is_owned_link; then
      ln -sfn -- "$shim" "$link"
    fi
    break
  fi
done

if [ -L "$legacy_link" ] && [ "$(readlink -- "$legacy_link" || true)" = "/opt/Amoeba/resources/bin/orca-ide" ]; then
  rm -f -- "$legacy_link"
fi

exit 0
