/// Bundle ids of the apps whose computer-use sidecar may drive this helper.
public enum TrustedOrcaApplication {
    public static func isTrusted(bundleId: String) -> Bool {
        // Why: `pnpm dev` launches as `com.amoeba.desktop.dev` and per-worktree wrapper apps use
        // `com.amoeba.desktop.dev.<name>`; the sidecar peer check must authorize both (#26498).
        bundleId == "com.amoeba.desktop" ||
            bundleId == "com.amoeba.desktop.dev" ||
            bundleId.hasPrefix("com.amoeba.desktop.dev.") ||
            bundleId == "com.github.Electron"
    }
}
