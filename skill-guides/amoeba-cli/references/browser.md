# Built-in browser commands

Use a snapshot-interact-re-snapshot loop:

```text
AMOEBA goto --url https://example.com --json
AMOEBA snapshot --json
AMOEBA click --element @e3 --json
AMOEBA snapshot --json
```

Common commands:

```text
AMOEBA goto --url <url> --json
AMOEBA back --json
AMOEBA reload --json
AMOEBA snapshot --json
AMOEBA screenshot --json
AMOEBA full-screenshot --json
AMOEBA pdf --json
AMOEBA click --element <ref> --json
AMOEBA fill --element <ref> --value <text> --json
AMOEBA type --input <text> --json
AMOEBA select --element <ref> --value <value> --json
AMOEBA check --element <ref> --json
AMOEBA scroll --direction down --amount 1000 --json
AMOEBA hover --element <ref> --json
AMOEBA focus --element <ref> --json
AMOEBA keypress --key Enter --json
AMOEBA upload --element <ref> --files <paths> --json
AMOEBA wait --text <text> --json
AMOEBA wait --url <substring> --json
AMOEBA wait --selector <css> --json
AMOEBA wait --load networkidle --json
AMOEBA eval --expression <js> --json
AMOEBA tab list --json
AMOEBA tab create --url <url> --json
AMOEBA tab switch --index <n> --json
AMOEBA tab close --index <n> --json
AMOEBA cookie get --json
AMOEBA capture start --json
AMOEBA console --limit 50 --json
AMOEBA network --limit 50 --json
AMOEBA exec --command "help" --json
```

Browser rules:

- Re-snapshot after navigation, tab switches, clicks that change the page, and any `browser_stale_ref`.
- Refs like `@e1` are assigned by `snapshot`, scoped to one tab, and invalidated by navigation or tab switch.
- Browser commands default to the current worktree and its active tab. Use `--worktree all` only intentionally.
- For concurrent browser work, run `AMOEBA tab list --json`, read `tabs[].browserPageId`, and pass `--page <browserPageId>` on later commands.
- Use typed tab commands (`AMOEBA tab list/create/close/switch`), not `AMOEBA exec --command "tab ..."`, so Amoeba keeps UI state synchronized.
- Prefer `wait --text`, `--url`, `--selector`, or `--load` after async page changes instead of bare timeouts.
- Anything not listed above goes through `AMOEBA exec --command "<agent-browser command>"`.
- If `fill` or `type` fails on a custom input, try `AMOEBA focus --element @e1 --json` then `AMOEBA inserttext --text "text" --json`.
- A client-hosted page renders in the paired desktop's browser engine, so every command against it needs that desktop online and returns `browser_host_unavailable` while it is closed, asleep, or disconnected. Server-hosted pages run with no desktop attached; prefer them for long or unattended automation.

Common recoveries:

- `browser_no_tab`: open a tab with `AMOEBA tab create --url <url> --json`.
- `browser_stale_ref`: run `AMOEBA snapshot --json` and retry with fresh refs.
- `browser_tab_not_found`: run `AMOEBA tab list --json` before switching or closing.
- `browser_host_unavailable`: the desktop hosting the page is offline. Bring it back, or recreate the page with server placement if the work must outlive the desktop session.
