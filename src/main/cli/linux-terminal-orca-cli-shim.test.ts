import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runProcess } from '@orca/process-host'

vi.mock('electron', () => ({
  app: { isPackaged: true }
}))

import { resolveAppImageLauncherEndpointPath } from './appimage-stable-launcher'
import { ensureLinuxTerminalOrcaCliShimDir } from './linux-terminal-orca-cli-shim'

const created: string[] = []
const canFenceAppImageRuntime = process.platform === 'linux' && existsSync('/proc/self/stat')

async function makeFixture(): Promise<{ userDataPath: string; resourcesPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'orca-terminal-cli-shim-'))
  created.push(root)
  const resourcesPath = join(root, 'resources')
  mkdirSync(join(resourcesPath, 'bin'), { recursive: true })
  writeFileSync(join(resourcesPath, 'bin', 'amoeba'), '#!/usr/bin/env bash\n', 'utf8')
  return { userDataPath: join(root, 'user-data'), resourcesPath }
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('ensureLinuxTerminalOrcaCliShimDir', () => {
  it('uses the mounted bundled launcher when only APPDIR is inherited', async () => {
    const { userDataPath, resourcesPath } = await makeFixture()
    vi.stubEnv('APPIMAGE', '')
    vi.stubEnv('APPDIR', resourcesPath)

    const shimDir = ensureLinuxTerminalOrcaCliShimDir({ userDataPath, resourcesPath })

    expect(shimDir).toBe(join(userDataPath, 'linux-orca-cli-shim'))
    expect(readFileSync(join(shimDir!, 'amoeba'), 'utf8')).toContain(
      `exec '${join(resourcesPath, 'bin', 'amoeba')}' "$@"`
    )
  })

  it('writes an executable amoeba shim that execs the bundled launcher', async () => {
    const { userDataPath, resourcesPath } = await makeFixture()

    const shimDir = ensureLinuxTerminalOrcaCliShimDir({
      userDataPath,
      resourcesPath,
      appImagePath: null
    })

    expect(shimDir).toBe(join(userDataPath, 'linux-orca-cli-shim'))
    const content = readFileSync(join(shimDir!, 'amoeba'), 'utf8')
    // Single-quoted so a resources path with shell metacharacters can't break out.
    expect(content).toContain(`exec '${join(resourcesPath, 'bin', 'amoeba')}' "$@"`)
    const mode = statSync(join(shimDir!, 'amoeba')).mode & 0o777
    expect(mode & 0o111).not.toBe(0)
  })

  it('reuses the shim path and re-asserts its exec bit', async () => {
    const { userDataPath, resourcesPath } = await makeFixture()
    const options = { userDataPath, resourcesPath, appImagePath: null }

    const first = ensureLinuxTerminalOrcaCliShimDir(options)
    expect(first).not.toBeNull()
    const shimPath = join(first!, 'amoeba')
    chmodSync(shimPath, 0o644)

    const second = ensureLinuxTerminalOrcaCliShimDir(options)
    expect(second).toBe(first)
    expect(statSync(shimPath).mode & 0o111).not.toBe(0)

    const root = await mkdtemp(join(tmpdir(), 'orca-terminal-cli-shim-2-'))
    created.push(root)
    const otherUserData = join(root, 'user-data')
    const otherShimDir = join(otherUserData, 'linux-orca-cli-shim')
    mkdirSync(otherShimDir, { recursive: true })
    writeFileSync(join(otherShimDir, 'amoeba'), 'stale contents', 'utf8')
    chmodSync(join(otherShimDir, 'amoeba'), 0o644)
    // Pre-rename builds wrote the shim as `orca`; managed terminals must expose only `amoeba`.
    writeFileSync(join(otherShimDir, 'orca'), 'pre-rename shim', { mode: 0o755 })

    const healed = ensureLinuxTerminalOrcaCliShimDir({
      userDataPath: otherUserData,
      resourcesPath,
      appImagePath: null
    })
    expect(healed).not.toBeNull()
    const healedPath = join(healed!, 'amoeba')
    expect(readFileSync(healedPath, 'utf8')).toContain(join(resourcesPath, 'bin', 'amoeba'))
    expect(statSync(healedPath).mode & 0o111).not.toBe(0)
    expect(existsSync(join(otherShimDir, 'orca'))).toBe(false)
  })

  it.skipIf(!canFenceAppImageRuntime)(
    'routes first-use AppImage terminals through a fenced current mount without a live endpoint',
    async () => {
      const { userDataPath, resourcesPath } = await makeFixture()
      const appImagePath = join(userDataPath, 'Amoeba.AppImage')
      await mkdir(userDataPath, { recursive: true })
      await writeFile(appImagePath, '#!/usr/bin/env bash\n', { encoding: 'utf8', mode: 0o755 })
      const cacheRootPath = join(userDataPath, 'cache')
      const liveLauncherPath = join(resourcesPath, 'bin', 'amoeba')
      writeFileSync(liveLauncherPath, '#!/usr/bin/env bash\nprintf live', 'utf8')
      chmodSync(liveLauncherPath, 0o755)
      const shimDir = ensureLinuxTerminalOrcaCliShimDir({
        userDataPath,
        resourcesPath,
        appImagePath,
        appImageCacheRootPath: cacheRootPath
      })

      const shimPath = join(shimDir!, 'amoeba')
      const content = readFileSync(shimPath, 'utf8')
      expect(content).toContain(liveLauncherPath)
      expect(content).toContain('runtime_pid=')
      expect(content).toContain('/proc/$runtime_pid/stat')
      expect(existsSync(resolveAppImageLauncherEndpointPath(cacheRootPath, 'live'))).toBe(false)
      await expect(
        runProcess({ program: shimPath, args: [], timeoutMs: 3_000 })
      ).resolves.toMatchObject({ code: 0, stdout: 'live' })
    }
  )

  it.skipIf(!canFenceAppImageRuntime)(
    'refreshes restored terminals to the current AppImage mount',
    async () => {
      const { userDataPath, resourcesPath } = await makeFixture()
      const appImagePath = join(userDataPath, 'Amoeba.AppImage')
      await mkdir(userDataPath, { recursive: true })
      await writeFile(appImagePath, '#!/usr/bin/env bash\n', { encoding: 'utf8', mode: 0o755 })
      const cacheRootPath = join(userDataPath, 'cache')
      const firstLauncher = join(resourcesPath, 'bin', 'amoeba')
      writeFileSync(firstLauncher, '#!/usr/bin/env bash\nprintf first', 'utf8')
      chmodSync(firstLauncher, 0o755)
      const options = {
        userDataPath,
        resourcesPath,
        appImagePath,
        appImageCacheRootPath: cacheRootPath
      }
      const shimDir = ensureLinuxTerminalOrcaCliShimDir(options)
      const shimPath = join(shimDir!, 'amoeba')
      const originalShim = readFileSync(shimPath, 'utf8')

      const nextResourcesPath = join(userDataPath, 'next-mount', 'resources')
      const nextLauncher = join(nextResourcesPath, 'bin', 'amoeba')
      await mkdir(join(nextResourcesPath, 'bin'), { recursive: true })
      await writeFile(nextLauncher, '#!/usr/bin/env bash\nprintf next', { mode: 0o755 })
      await rm(firstLauncher)
      expect(
        ensureLinuxTerminalOrcaCliShimDir({ ...options, resourcesPath: nextResourcesPath })
      ).toBe(shimDir)

      const refreshedShim = readFileSync(shimPath, 'utf8')
      expect(refreshedShim).not.toBe(originalShim)
      expect(refreshedShim).toContain(nextLauncher)
      expect(existsSync(resolveAppImageLauncherEndpointPath(cacheRootPath, 'live'))).toBe(false)
      await expect(
        runProcess({ program: shimPath, args: [], timeoutMs: 3_000 })
      ).resolves.toMatchObject({ code: 0, stdout: 'next' })
    }
  )

  it.skipIf(!canFenceAppImageRuntime)(
    'rejects a stale shim when its mount path is removed and reused',
    async () => {
      const { userDataPath, resourcesPath } = await makeFixture()
      const appImagePath = join(userDataPath, 'Amoeba.AppImage')
      const cacheRootPath = join(userDataPath, 'cache')
      await mkdir(userDataPath, { recursive: true })
      await writeFile(appImagePath, '#!/usr/bin/env bash\n', { mode: 0o755 })
      const liveLauncher = join(resourcesPath, 'bin', 'amoeba')
      writeFileSync(liveLauncher, '#!/usr/bin/env bash\nprintf original', { mode: 0o755 })
      const shimDir = ensureLinuxTerminalOrcaCliShimDir({
        userDataPath,
        resourcesPath,
        appImagePath,
        appImageCacheRootPath: cacheRootPath
      })
      const shimPath = join(shimDir!, 'amoeba')
      await rm(liveLauncher)
      await writeFile(liveLauncher, '#!/usr/bin/env bash\nprintf replaced-by-another-mount', {
        mode: 0o755
      })

      await expect(
        runProcess({ program: shimPath, args: [], timeoutMs: 3_000 })
      ).resolves.toMatchObject({ code: 1, stdout: '' })
    }
  )

  it.skipIf(!canFenceAppImageRuntime)(
    'rejects a shim after its owning AppImage process generation changes',
    async () => {
      const { userDataPath, resourcesPath } = await makeFixture()
      const appImagePath = join(userDataPath, 'Amoeba.AppImage')
      await mkdir(userDataPath, { recursive: true })
      await writeFile(appImagePath, '#!/usr/bin/env bash\n', { mode: 0o755 })
      const liveLauncher = join(resourcesPath, 'bin', 'amoeba')
      writeFileSync(liveLauncher, '#!/usr/bin/env bash\nprintf original', { mode: 0o755 })
      const shimDir = ensureLinuxTerminalOrcaCliShimDir({
        userDataPath,
        resourcesPath,
        appImagePath,
        appImageCacheRootPath: join(userDataPath, 'cache')
      })
      const shimPath = join(shimDir!, 'amoeba')
      const staleContent = readFileSync(shimPath, 'utf8').replace(
        /runtime_start_time='[^']*'/,
        "runtime_start_time='stale-process'"
      )
      writeFileSync(shimPath, staleContent, { mode: 0o755 })

      await expect(
        runProcess({ program: shimPath, args: [], timeoutMs: 3_000 })
      ).resolves.toMatchObject({ code: 1, stdout: '' })
    }
  )

  it('returns null (and does not memoize) when the bundled launcher is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-terminal-cli-shim-missing-'))
    created.push(root)
    const userDataPath = join(root, 'user-data')

    const missing = ensureLinuxTerminalOrcaCliShimDir({
      userDataPath,
      resourcesPath: join(root, 'resources'),
      appImagePath: null
    })
    expect(missing).toBeNull()

    const resourcesPath = join(root, 'resources')
    mkdirSync(join(resourcesPath, 'bin'), { recursive: true })
    writeFileSync(join(resourcesPath, 'bin', 'amoeba'), '#!/usr/bin/env bash\n', 'utf8')
    const recovered = ensureLinuxTerminalOrcaCliShimDir({
      userDataPath,
      resourcesPath,
      appImagePath: null
    })
    expect(recovered).toBe(join(userDataPath, 'linux-orca-cli-shim'))
  })
})
