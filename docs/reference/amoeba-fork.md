# Amoeba fork

The first implementation keeps the existing project/workspace sidebar and agent runtime. A New task action opens the existing project-aware creation flow. Each workspace pane now provides a conversation chooser, the existing agent launch menu, and direct Browser, Changes, Terminal, and Tabs controls. Structured conversations use the compact view by default; full tabs remain available for closing, renaming, splitting, and other advanced operations.

Browser pages remain workspace-owned in this slice. Conversations in the same pane reuse its browser tab. A browser shared across separate worktrees in a project requires a subsequent ownership and persistence change.

Display branding, translations, documentation, desktop application identity, and development profiles use Amoeba. The CLI exposes `amoeba` and `amoeba-dev`; legacy command aliases remain available. Existing website URLs are unchanged. Automatic upstream updates are disabled for Amoeba builds so they cannot install the upstream application.

Compatibility names are deliberately retained: IPC/RPC and HTTP headers, environment variables, URL schemes, stored-data keys, package/module identifiers, native extension names, and internal source paths. Vendored patches, copyright notices, and third-party licenses retain their original bytes. Renaming these contracts requires explicit migration and mixed-version testing, rather than a branding replacement.

Project config is `amoeba.yaml` and repo-local files (issue-command override, drops, browser downloads, Markdown templates) live under `.amoeba/`. Amoeba and Orca coexist as separate apps, so Amoeba never reads a repo's `orca.yaml` or `.orca/`; the `.gitignore` entry Amoeba adds is `.amoeba` and an existing `.orca` line is left alone.

Historical terminal recordings, case-sensitivity test inputs, upstream release manifests, and references to the unrelated GNOME Orca screen reader retain their original names. Connection-recovery and diagnostic-footer readers accept both Amoeba and Orca wording.

Validation uses Node 24, the repository's locked dependencies, background-only tests, and headless component fixtures. The repository refers to an `$electron` skill that is not present in this checkout or the installed skill directories; full Electron interaction checks require that skill. Building the desktop bundles and capturing component fixtures do not launch a visible application.

The final focused regression run passed 132 files and 1,839 tests, with 14 skipped. Desktop bundles, typechecking, changed-code quality, generated skill and plugin resources, and desktop/narrow component screenshots also passed validation.

The repository-wide `check:changed` run is not green in this environment. Historical cross-version tests require missing release tags; other checks require cloud dependencies or newer Bash features. A comparison against untouched upstream source reproduced 23 storage and agent-launch assertion failures. Use a canonical temporary directory such as `TMPDIR=/private/tmp` on macOS to avoid `/var` versus `/private/var` fixture mismatches. These limitations are separate from the focused implementation and branding regression checks.
