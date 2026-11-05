<!-- Single-authored blocks shared by every skill stub. -->

<!-- block: resolver -->

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `ORCA_CLI_COMMAND` environment variable is set, use its value. Amoeba exports this
  for managed sessions.
- Otherwise, in a dev checkout whose session exposes `ORCA_DEV_REPO_ROOT`, use `amoeba-dev`.
- Otherwise, use `amoeba`.

Below, `AMOEBA` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `AMOEBA` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Amoeba build.

<!-- block: no-guessing -->

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Amoeba is not running, start it with `AMOEBA open --json`
and retry. If it fails with `runtime_access_denied`, your sandbox blocked the connection:
re-run it with escalated permissions, and do not run `AMOEBA open` or restart Amoeba. If
`skills get` is unknown, explain that updating Amoeba restores the guide; use `--help` for
read-only discovery and do not guess unsupported commands.
