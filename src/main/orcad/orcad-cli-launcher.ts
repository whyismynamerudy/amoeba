import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ORCAD_CLI_ENTRY_FILENAME,
  ORCAD_WINDOWS_CLI_LAUNCHER_FILENAME
} from '../../shared/orcad-artifacts'
import { nodeFileContentsEqual } from '../../shared/node-file-content-equality'
import { buildUnixCliLauncher } from '../cli/cli-dev-launcher'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import { resolveOrcadInstallRoot, resolveUserDataPath } from './orcad-app-paths'
import { AMOEBA_CLI_COMMAND_NAME } from '../../shared/orca-cli-command-name'

const LEGACY_POSIX_LAUNCHER_NAME = 'orca'

// The native Windows launcher selects server mode when this sibling config exists.
export const ORCAD_WINDOWS_CLI_LAUNCHER_CONFIG_FILENAME = 'orca-launcher.cfg'
const RETIRED_LAUNCHER_SUFFIX = '.retired'

let launcherPath: string | null = null

export function getOrcadCliLauncherPath(): string | null {
  return launcherPath
}

export async function prepareOrcadCliLauncher(): Promise<void> {
  launcherPath = null
  const installRoot = resolveOrcadInstallRoot()
  const entry = join(installRoot, ...ORCAD_CLI_ENTRY_FILENAME.split('/'))
  // Older slots and source-only runs may lack the CLI.
  if (!existsSync(entry)) {
    return
  }
  const userDataPath = resolveUserDataPath()
  const binDir = join(userDataPath, 'cli', 'bin')
  if (process.platform === 'win32') {
    launcherPath = await prepareWindowsLauncher(installRoot, entry, userDataPath, binDir)
    return
  }
  const path = join(binDir, AMOEBA_CLI_COMMAND_NAME)
  const script = buildUnixCliLauncher(process.execPath, entry, userDataPath, 'node')
  await mkdir(binDir, { recursive: true })
  await removeLegacyLaunchers(binDir, [LEGACY_POSIX_LAUNCHER_NAME])
  const current = await readFile(path, 'utf8').catch(() => null)
  if (current !== script) {
    writeFileAtomically(path, script, { mode: 0o700 })
  }
  await chmod(path, 0o700)
  launcherPath = path
}

export function buildWindowsCliLauncherConfig(
  nodePath: string,
  cliEntryPath: string,
  userDataPath: string
): string {
  return `node=${nodePath}\ncli=${cliEntryPath}\nuser-data=${userDataPath}\n`
}

/** Native exe preserves arguments that cmd.exe reparses through batch %*. */
async function prepareWindowsLauncher(
  installRoot: string,
  entry: string,
  userDataPath: string,
  binDir: string
): Promise<string | null> {
  const source = join(installRoot, ...ORCAD_WINDOWS_CLI_LAUNCHER_FILENAME.split('/'))
  if (!existsSync(source)) {
    return null
  }
  const path = join(binDir, `${AMOEBA_CLI_COMMAND_NAME}.exe`)
  await mkdir(binDir, { recursive: true })
  await removeRetiredLaunchers(binDir)
  await removeLegacyLaunchers(binDir, [`${LEGACY_POSIX_LAUNCHER_NAME}.exe`])
  await publishWindowsLauncher(path, await readFile(source))
  const configPath = join(binDir, ORCAD_WINDOWS_CLI_LAUNCHER_CONFIG_FILENAME)
  const config = buildWindowsCliLauncherConfig(process.execPath, entry, userDataPath)
  if ((await readFile(configPath, 'utf8').catch(() => null)) !== config) {
    writeFileAtomically(configPath, config)
  }
  return path
}

async function publishWindowsLauncher(path: string, binary: Buffer): Promise<void> {
  if (await nodeFileContentsEqual(path, binary).catch(() => false)) {
    return
  }
  try {
    writeFileAtomically(path, binary)
  } catch {
    // Windows locks running images against overwrite but allows retirement by rename.
    await rename(path, `${path}.${randomUUID()}${RETIRED_LAUNCHER_SUFFIX}`)
    writeFileAtomically(path, binary)
  }
}

/** Pre-rename slots wrote `orca` into this private bin dir; terminals here must expose only `amoeba`. */
async function removeLegacyLaunchers(binDir: string, names: readonly string[]): Promise<void> {
  // A running Windows image cannot be deleted; a later start retries.
  await Promise.all(names.map((name) => rm(join(binDir, name), { force: true }).catch(() => {})))
}

async function removeRetiredLaunchers(binDir: string): Promise<void> {
  const names = await readdir(binDir).catch(() => [])
  await Promise.all(
    names
      .filter((name) => name.includes('.exe.') && name.endsWith(RETIRED_LAUNCHER_SUFFIX))
      // Running retired images remain until a later cleanup.
      .map((name) => rm(join(binDir, name), { force: true }).catch(() => {}))
  )
}
