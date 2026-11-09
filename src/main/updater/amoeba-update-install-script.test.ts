import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProcess, spawnProcess } from '@orca/process-host'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { amoebaInstallScriptArgv } from './amoeba-update-install-script'

// The helper is a POSIX shell script that only ever runs on macOS.
describe.skipIf(process.platform === 'win32')('Amoeba install helper script', () => {
  let root: string
  let target: string
  let staged: string
  let backup: string
  let openLog: string
  let fakeOpen: string

  async function makeBundle(path: string, version: string): Promise<void> {
    await mkdir(join(path, 'Contents'), { recursive: true })
    await writeFile(join(path, 'Contents', 'version'), version)
  }

  async function bundleVersion(path: string): Promise<string | null> {
    return readFile(join(path, 'Contents', 'version'), 'utf8').catch(() => null)
  }

  async function exists(path: string): Promise<boolean> {
    return stat(path).then(
      () => true,
      () => false
    )
  }

  /** Records each launch; exits 1 when asked to launch the updated bundle and `failNew` is set. */
  async function installFakeOpen(failNew: boolean): Promise<void> {
    await writeFile(
      fakeOpen,
      `#!/bin/sh\necho "$(cat "$1/Contents/version")" >> "${openLog}"\n${
        failNew ? `[ "$(cat "$1/Contents/version")" = new ] && exit 1\n` : ''
      }exit 0\n`
    )
    await chmod(fakeOpen, 0o755)
  }

  async function runHelper({
    appPid = 999_999,
    relaunch = true
  }: { appPid?: number; relaunch?: boolean } = {}): Promise<number | null> {
    const result = await runProcess({
      program: '/bin/sh',
      args: amoebaInstallScriptArgv({
        appPid,
        targetBundle: target,
        stagedBundle: staged,
        backupBundle: backup,
        relaunch,
        logPath: join(root, 'install.log'),
        openBinary: fakeOpen,
        waitSeconds: 5
      }),
      timeoutMs: 15_000
    })
    return result.code
  }

  async function launches(): Promise<string[]> {
    const log = await readFile(openLog, 'utf8').catch(() => '')
    return log.split('\n').filter(Boolean)
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'amoeba-install-script-test-'))
    target = join(root, 'Applications', 'Amoeba.app')
    staged = join(root, 'cache', 'staged', 'Amoeba.app')
    backup = join(root, 'Applications', '.Amoeba.app.previous')
    openLog = join(root, 'open.log')
    fakeOpen = join(root, 'fake-open')
    await makeBundle(target, 'old')
    await makeBundle(staged, 'new')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('waits for the app to exit, swaps bundles, relaunches, and drops the backup', async () => {
    await installFakeOpen(false)
    const app = spawnProcess({ program: '/bin/sleep', args: ['0.5'], stdio: 'ignore' })
    const exited = new Promise((resolve) => app.once('exit', resolve))
    const helper = runHelper({ appPid: app.pid ?? 0 })
    // The swap must not start while the app is still running.
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(await bundleVersion(target)).toBe('old')
    await exited
    expect(await helper).toBe(0)
    expect(await bundleVersion(target)).toBe('new')
    expect(await exists(backup)).toBe(false)
    expect(await launches()).toEqual(['new'])
  })

  it('restores and relaunches the previous version when the update will not launch', async () => {
    await installFakeOpen(true)
    expect(await runHelper()).toBe(1)
    expect(await bundleVersion(target)).toBe('old')
    expect(await exists(backup)).toBe(false)
    expect(await launches()).toEqual(['new', 'old'])
  })

  it('leaves the app untouched and relaunches it when the staged bundle is missing', async () => {
    await installFakeOpen(false)
    await rm(staged, { recursive: true })
    expect(await runHelper()).toBe(1)
    expect(await bundleVersion(target)).toBe('old')
    expect(await launches()).toEqual(['old'])
  })

  it('installs silently on quit and recovers a backup stranded by an interrupted run', async () => {
    await installFakeOpen(false)
    await rm(target, { recursive: true })
    await makeBundle(backup, 'old')
    expect(await runHelper({ relaunch: false })).toBe(0)
    expect(await bundleVersion(target)).toBe('new')
    expect(await exists(backup)).toBe(false)
    expect(await launches()).toEqual([])
  })
})
