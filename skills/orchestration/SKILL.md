---
name: orchestration
description: >-
  Coordinate supervised Amoeba workers: threaded messages, blocking ask/reply,
  task dispatch, worker_done/escalation waits, task DAGs, decision gates,
  coordinator loops, and decomposing work across agents. Use `amoeba-cli` for full
  ownership handoffs — "hand off", "handoff", "handover", "give this to another
  agent", "another worktree" — unless asked to supervise, monitor, or coordinate
  a DAG, and for terminal control, lightweight terminal prompts, shell commands,
  Amoeba worktree management, and reading or waiting on terminals.
---

# Amoeba Orchestration

This file is a discovery stub, not the usage guide. The full, version-matched Amoeba
orchestration reference is served by the `amoeba` binary itself — kept out of this file on
purpose so it can never drift from the binary that will actually run your commands.

Engage Amoeba orchestration whenever you need structured multi-agent coordination: threaded
messages, blocking ask/reply flows, task dispatch, worker_done/escalation waits, task DAGs,
decision gates, coordinator loops, or decomposing work across agents. Use the amoeba-cli skill
instead for full ownership handoffs ("hand off", "handoff", "handover", "give this to
another agent", "another worktree") when the user did not ask to supervise, monitor, wait
for results, or coordinate a DAG — and for ordinary terminal control, shell commands,
worktree management, and the built-in browser. Coordination requires real Amoeba runtime
state; never substitute a non-Amoeba subagent tool.

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

## Load the version-matched guide before running Amoeba commands

```text
AMOEBA skills get orchestration
```

That prints the compact, version-matched guide for the exact binary that will handle your
next commands. It covers the normal local coordinator loop. For a conditional action gate
such as remote placement, uncertain release recovery, or expanded DAG work, load only the
reference that gate names with
`AMOEBA skills get orchestration --reference references/<file>.md`
(`--references` lists the names). If that binary rejects `--reference`, run
`AMOEBA skills get orchestration --full` and read the named bundled reference before acting.

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Amoeba is not running, start it with `AMOEBA open --json`
and retry. If it fails with `runtime_access_denied`, your sandbox blocked the connection:
re-run it with escalated permissions, and do not run `AMOEBA open` or restart Amoeba. If
`skills get` is unknown, explain that updating Amoeba restores the guide; use `--help` for
read-only discovery and do not guess unsupported commands.
