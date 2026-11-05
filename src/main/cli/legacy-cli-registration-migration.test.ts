import { lstat, mkdir, mkdtemp, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CliInstallerOptions } from './cli-installer-contracts'
import type * as CliInstallerModule from './cli-installer'

const fixtureOptions = vi.hoisted(() => {
  const current: CliInstallerOptions = {}
  return { current }
})

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => tmpdir(), getAppPath: () => tmpdir() }
}))

// The migration builds its own installer; pin it to the fixture instead of the real home and app.
vi.mock('./cli-installer', async (importOriginal) => {
  const actual = await importOriginal<typeof CliInstallerModule>()
  class FixtureCliInstaller extends actual.CliInstaller {
    constructor(options: CliInstallerOptions = {}) {
      super({ ...fixtureOptions.current, ...options })
    }
  }
  return { CliInstaller: FixtureCliInstaller }
})

import { CliInstaller } from './cli-installer'
import { migrateLegacyCliRegistration } from './legacy-cli-registration-migration'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function makeLinuxInstall() {
  const root = await mkdtemp(join(tmpdir(), 'amoeba-legacy-migration-'))
  roots.push(root)
  const homePath = join(root, 'home')
  const commandDir = join(homePath, '.local', 'bin')
  const resourcesPath = join(root, 'resources')
  await mkdir(commandDir, { recursive: true })
  await mkdir(join(resourcesPath, 'bin'), { recursive: true })
  await writeFile(join(resourcesPath, 'bin', 'amoeba'), '#!/usr/bin/env bash\n', { mode: 0o755 })
  fixtureOptions.current = {
    platform: 'linux',
    isPackaged: true,
    userDataPath: join(root, 'user-data'),
    appPath: join(resourcesPath, 'app.asar'),
    resourcesPath,
    homePath,
    processPathEnv: commandDir,
    appImagePath: null
  }
  return { commandDir, resourcesPath }
}

describe.skipIf(process.platform === 'win32')('migrateLegacyCliRegistration', () => {
  it('registers amoeba without privileges in place of an Amoeba-owned orca-ide link', async () => {
    const { commandDir, resourcesPath } = await makeLinuxInstall()
    const legacyPath = join(commandDir, 'orca-ide')
    await symlink(join(resourcesPath, 'bin', 'orca-ide'), legacyPath)
    const status = await new CliInstaller().getStatus()
    expect(status.state).toBe('not_installed')

    const migrated = await migrateLegacyCliRegistration(status)

    expect(migrated).toMatchObject({ state: 'installed', commandPath: join(commandDir, 'amoeba') })
    await expect(readlink(join(commandDir, 'amoeba'))).resolves.toBe(
      join(resourcesPath, 'bin', 'amoeba')
    )
    await expect(lstat(legacyPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does nothing when the only orca command belongs to another app', async () => {
    const { commandDir } = await makeLinuxInstall()
    const realOrcaTarget = '/opt/orca-ide/resources/bin/orca'
    await symlink(realOrcaTarget, join(commandDir, 'orca'))
    const status = await new CliInstaller().getStatus()

    await expect(migrateLegacyCliRegistration(status)).resolves.toBeNull()
    await expect(lstat(join(commandDir, 'amoeba'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readlink(join(commandDir, 'orca'))).resolves.toBe(realOrcaTarget)
  })
})
