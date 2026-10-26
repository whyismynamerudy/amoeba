cask "orca" do
  arch arm: "arm64", intel: "x64"

  version "1.3.24"
  sha256 arm:   "fc707f290ff3b631b7b7947bf339885b61a43d2e89475997c125b61268ed4966",
         intel: "5f677c13a08f7a5740442e29d388285a86488c8c1f7aa5f10a8721a2c6ede8e4"

  url "https://github.com/stablyai/orca/releases/download/v#{version}/orca-macos-#{arch}.dmg"
  name "Amoeba"
  desc "IDE for orchestrating AI coding agents across terminals and worktrees"
  homepage "https://onorca.dev/"

  livecheck do
    url :url
    strategy :github_latest
  end

  # Let the in-app updater own updates; Homebrew skips auto_updates unless --greedy.
  auto_updates true
  conflicts_with cask: "orca@rc"
  depends_on macos: :big_sur

  app "Amoeba.app"

  # Expose the symlink-resolving bundled CLI on PATH so headless hosts can use orca serve without the in-app installer.
  binary "#{appdir}/Amoeba.app/Contents/Resources/bin/orca"

  # Zap app-created ~/.orca and Electron userData for a clean uninstall.
  zap trash: [
    "~/.orca",
    "~/Library/Application Support/Amoeba",
    "~/Library/Caches/com.amoeba.desktop",
    "~/Library/Caches/com.amoeba.desktop.ShipIt",
    "~/Library/HTTPStorages/com.amoeba.desktop",
    "~/Library/Preferences/com.amoeba.desktop.plist",
    "~/Library/Saved Application State/com.amoeba.desktop.savedState",
  ]
end
