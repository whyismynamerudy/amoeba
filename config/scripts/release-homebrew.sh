#!/usr/bin/env bash
# Build an unsigned Apple Silicon DMG, publish it as a GitHub release, and bump the Homebrew cask.
# Usage: pnpm release:homebrew <x.y.z>
set -euo pipefail

REPO=whyismynamerudy/amoeba
TAP_REPO=whyismynamerudy/homebrew-amoeba
APP=dist/mac-arm64/Amoeba.app
DMG=dist/orca-macos-arm64.dmg

die() {
  echo "release-homebrew: $*" >&2
  exit 1
}

version="${1:-}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "usage: pnpm release:homebrew <x.y.z>"
tag="v$version"

[[ "$(uname -s)" == Darwin && "$(uname -m)" == arm64 ]] || die "run this on an Apple Silicon Mac"
cd "$(git rev-parse --show-toplevel)"
gh auth status >/dev/null 2>&1 || die "gh is not logged in"
# Without user.email git guesses from the hostname, which fails on a bare name like "Mac".
if ! git var GIT_COMMITTER_IDENT >/dev/null 2>&1; then
  read -r gh_id gh_login < <(gh api user --jq '"\(.id) \(.login)"')
  GIT_AUTHOR_NAME="$(gh api user --jq '.name // .login')"
  GIT_AUTHOR_EMAIL="$gh_id+$gh_login@users.noreply.github.com"
  export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL
  export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
fi
[[ -z "$(git status --porcelain)" ]] || die "commit or discard local changes first"
git fetch -q origin main
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || die "HEAD must match origin/main"
if gh release view "$tag" --repo "$REPO" >/dev/null 2>&1; then
  die "release $tag already exists"
fi

current="$(node -p "require('./package.json').version")"
node -e '
  const [next, current] = process.argv.slice(1).map((v) => v.split(".").map(Number))
  process.exit((next[0] - current[0] || next[1] - current[1] || next[2] - current[2]) >= 0 ? 0 : 1)
' "$version" "$current" || die "$version is lower than package.json's $current"

# Roll back the version bump if anything fails before it is committed.
bumped=false
trap '$bumped && git checkout -q -- package.json' EXIT
if [[ "$current" != "$version" ]]; then
  node -e '
    const fs = require("node:fs")
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
    pkg.version = process.argv[1]
    fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`)
  ' "$version"
  bumped=true
fi

echo "==> Building Amoeba $version"
pnpm run build:desktop
pnpm run build:computer-macos
pnpm run build:keyboard-layout-macos
pnpm run build:notification-status-macos
pnpm run ensure:electron-runtime
rm -rf "$APP" "$DMG" "$DMG.blockmap"
pnpm exec electron-builder --config config/electron-builder.config.cjs --mac dir:arm64 --publish never

# Without a Developer ID, electron-builder leaves a broken seal that Apple Silicon reports as "damaged".
echo "==> Ad-hoc signing"
codesign --force --deep --sign - "$APP"
codesign --force --sign - --entitlements resources/build/entitlements.mac.plist "$APP"
codesign --verify --deep --strict "$APP"
built_version="$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$APP/Contents/Info.plist")"
[[ "$built_version" == "$version" ]] || die "built app reports $built_version, expected $version"

echo "==> Packaging DMG"
pnpm exec electron-builder --config config/electron-builder.config.cjs --mac dmg:arm64 \
  --prepackaged "$APP" --publish never
mount_dir="$(mktemp -d)"
hdiutil attach -nobrowse -readonly -mountpoint "$mount_dir" "$DMG" >/dev/null
codesign --verify --deep --strict "$mount_dir/Amoeba.app" || {
  hdiutil detach "$mount_dir" >/dev/null
  die "app inside the DMG failed signature verification"
}
hdiutil detach "$mount_dir" >/dev/null
sha="$(shasum -a 256 "$DMG" | awk '{print $1}')"

if $bumped; then
  echo "==> Committing version bump"
  git commit -q -m "chore(amoeba): release $tag" -- package.json
  bumped=false
  git push -q origin HEAD:main
fi

echo "==> Publishing GitHub release $tag"
gh release create "$tag" "$DMG" --repo "$REPO" --target "$(git rev-parse HEAD)" \
  --title "Amoeba $version" --notes "$(
    cat <<'EOF'
Install or update with Homebrew (Apple Silicon only):

```
brew install --cask whyismynamerudy/amoeba/amoeba
brew upgrade --cask amoeba
```

This build is not signed with an Apple Developer ID or notarized. If you install from the DMG directly, macOS will block the first launch. Either go to System Settings → Privacy & Security → "Open Anyway", or run:

```
xattr -dr com.apple.quarantine /Applications/Amoeba.app
```
EOF
  )"
uploaded_sha="$(gh release view "$tag" --repo "$REPO" --json assets \
  --jq '.assets[] | select(.name == "orca-macos-arm64.dmg") | .digest')"
[[ "$uploaded_sha" == "sha256:$sha" ]] || die "uploaded DMG digest $uploaded_sha does not match $sha"

echo "==> Bumping Homebrew cask"
tap_dir="$(mktemp -d)"
gh repo clone "$TAP_REPO" "$tap_dir" -- -q
sed -i '' -E \
  -e "s/^  version \"[^\"]+\"/  version \"$version\"/" \
  -e "s/^  sha256 \"[0-9a-f]+\"/  sha256 \"$sha\"/" \
  "$tap_dir/Casks/amoeba.rb"
# Amoeba updates itself in place; tell brew so `brew upgrade` doesn't fight it.
if ! grep -q '^  auto_updates true' "$tap_dir/Casks/amoeba.rb"; then
  perl -0pi -e 's/(\n  depends_on arch:)/\n  auto_updates true\n$1/' "$tap_dir/Casks/amoeba.rb"
fi
git -C "$tap_dir" commit -q -am "amoeba $version"
git -C "$tap_dir" push -q origin main
rm -rf "$tap_dir"

echo "==> Released Amoeba $version"
echo "    https://github.com/$REPO/releases/tag/$tag"
echo "    Users update with: brew update && brew upgrade --cask amoeba"
