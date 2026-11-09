// Runs detached after Amoeba exits: swap bundles, relaunch, and roll back on any failure.
// Args: app pid, target bundle, staged bundle, backup path, relaunch (1|0), log file, open binary, wait seconds.
export const AMOEBA_INSTALL_SCRIPT = `
APP_PID="$1"; TARGET="$2"; STAGED="$3"; BACKUP="$4"; RELAUNCH="$5"; LOG="$6"
OPEN_BIN="\${7:-/usr/bin/open}"; WAIT_SECONDS="\${8:-600}"
exec >>"$LOG" 2>&1
log() { echo "$(date '+%Y-%m-%dT%H:%M:%S') $*"; }
launch() { if [ "$RELAUNCH" = 1 ]; then "$OPEN_BIN" "$1"; fi; }

ticks=0
while kill -0 "$APP_PID" 2>/dev/null; do
  if [ "$ticks" -ge $((WAIT_SECONDS * 5)) ]; then
    log "Amoeba (pid $APP_PID) did not exit; update skipped"
    exit 1
  fi
  sleep 0.2
  ticks=$((ticks + 1))
done

# A crashed earlier run may have left only the backup behind.
if [ -e "$BACKUP" ]; then
  if [ -d "$TARGET" ]; then rm -rf "$BACKUP"; else mv "$BACKUP" "$TARGET"; fi
fi
if [ ! -d "$STAGED" ]; then
  log "staged bundle missing: $STAGED"
  launch "$TARGET"
  exit 1
fi
if ! mv "$TARGET" "$BACKUP"; then
  log "could not move $TARGET aside"
  launch "$TARGET"
  exit 1
fi

restore() {
  log "$1; restoring previous version"
  rm -rf "$TARGET"
  if mv "$BACKUP" "$TARGET"; then
    launch "$TARGET"
  else
    log "restore failed; previous version left at $BACKUP"
  fi
  exit 1
}

mv "$STAGED" "$TARGET" || restore "could not move the update into place"
xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null || true
if [ "$RELAUNCH" = 1 ]; then
  "$OPEN_BIN" "$TARGET" || restore "could not launch the updated app"
fi
rm -rf "$BACKUP"
log "installed update into $TARGET"
`

export type AmoebaInstallScriptArgs = {
  appPid: number
  targetBundle: string
  stagedBundle: string
  backupBundle: string
  relaunch: boolean
  logPath: string
  openBinary?: string
  waitSeconds?: number
}

/** `sh -c` argv: the script, then $0 and its positional arguments. */
export function amoebaInstallScriptArgv(args: AmoebaInstallScriptArgs): string[] {
  return [
    '-c',
    AMOEBA_INSTALL_SCRIPT,
    'amoeba-update',
    String(args.appPid),
    args.targetBundle,
    args.stagedBundle,
    args.backupBundle,
    args.relaunch ? '1' : '0',
    args.logPath,
    args.openBinary ?? '/usr/bin/open',
    String(args.waitSeconds ?? 600)
  ]
}
