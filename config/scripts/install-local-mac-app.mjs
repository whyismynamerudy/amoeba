// Build this checkout as a macOS .app for the current CPU, ad-hoc sign it, and install it to /Applications.
// Personal installs skip dmg/zip and the other architecture, which is most of `build:mac`'s time.

import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { getLocalBuildIdentity } from './build-mac-local.mjs'

const INSTALL_PATH = '/Applications/Orca.app'

function run(command, args, env) {
  console.log(`[install:mac:local] ${command} ${args.join(' ')}`)
  execFileSync(command, args, { stdio: 'inherit', env: { ...process.env, ...env } })
}

function isInstalledAppRunning() {
  try {
    execFileSync('pgrep', ['-f', `${INSTALL_PATH}/Contents/MacOS/`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (process.platform !== 'darwin') {
  throw new Error('install:mac:local only runs on macOS.')
}
if (isInstalledAppRunning()) {
  throw new Error(`Quit ${INSTALL_PATH} before installing a new build.`)
}

const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
const builtApp = resolve(`dist/mac${arch === 'arm64' ? '-arm64' : ''}/Orca.app`)

// The packaged app embeds the mobile web client, which builds from mobile's own install.
if (!existsSync(resolve('mobile/node_modules'))) {
  run('pnpm', ['--dir', 'mobile', 'install', '--frozen-lockfile'])
}
run('pnpm', ['run', 'build:desktop'])
for (const helper of [
  'build:computer-macos',
  'build:keyboard-layout-macos',
  'build:notification-status-macos',
  'ensure:electron-runtime'
]) {
  run('pnpm', ['run', helper])
}
const identity = getLocalBuildIdentity()
run(
  'pnpm',
  [
    'exec',
    'electron-builder',
    '--config',
    'config/electron-builder.config.cjs',
    '--mac',
    'dir',
    `--${arch}`
  ],
  { ORCA_BUILD_COMMIT: identity.commit, ORCA_LOCAL_BUILD_VERSION: identity.version }
)

// Without a Developer ID, seal every nested bundle ad hoc, then the app with its entitlements.
run('codesign', ['--force', '--deep', '--sign', '-', builtApp])
run('codesign', [
  '--force',
  '--sign',
  '-',
  '--entitlements',
  resolve('resources/build/entitlements.mac.plist'),
  builtApp
])
run('codesign', ['--verify', '--deep', '--strict', builtApp])

rmSync(INSTALL_PATH, { recursive: true, force: true })
run('ditto', [builtApp, INSTALL_PATH])
console.log(`[install:mac:local] Installed ${identity.version} at ${INSTALL_PATH}`)
