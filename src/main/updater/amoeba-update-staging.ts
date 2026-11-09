import { mkdir, mkdtemp, readdir, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProcessResult, ProcessSpec } from '@orca/process-host/process-spec'

export const AMOEBA_BUNDLE_NAME = 'Amoeba.app'

export type StagingProcessRunner = (spec: ProcessSpec) => Promise<ProcessResult>

export class AmoebaStagingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AmoebaStagingError'
  }
}

async function runChecked(
  run: StagingProcessRunner,
  spec: ProcessSpec,
  failure: string
): Promise<ProcessResult> {
  const result = await run(spec)
  if (result.code !== 0 || result.timedOut) {
    const detail = result.stderr.trim().split('\n').at(-1)
    throw new AmoebaStagingError(detail ? `${failure} (${detail})` : failure)
  }
  return result
}

async function detach(run: StagingProcessRunner, mountDir: string): Promise<void> {
  const base = { program: '/usr/bin/hdiutil', timeoutMs: 60_000 }
  const result = await run({ ...base, args: ['detach', mountDir] }).catch(() => null)
  if (result?.code !== 0) {
    // Spotlight or Finder can briefly hold the volume; a forced detach still releases it.
    await run({ ...base, args: ['detach', '-force', mountDir] }).catch(() => null)
  }
}

/** Copies the bundle out of the verified DMG, then proves its version and signature seal before install. */
export async function stageAmoebaBundle({
  dmgPath,
  stagingDir,
  expectedVersion,
  run,
  mountParent = tmpdir()
}: {
  dmgPath: string
  stagingDir: string
  expectedVersion: string
  run: StagingProcessRunner
  mountParent?: string
}): Promise<string> {
  await rm(stagingDir, { recursive: true, force: true })
  await mkdir(stagingDir, { recursive: true })
  const stagedApp = join(stagingDir, AMOEBA_BUNDLE_NAME)
  const mountDir = await mkdtemp(join(mountParent, 'amoeba-update-'))
  try {
    await runChecked(
      run,
      {
        program: '/usr/bin/hdiutil',
        args: ['attach', '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mountDir, dmgPath],
        timeoutMs: 120_000
      },
      'Could not open the downloaded update'
    )
    try {
      const entries = await readdir(mountDir)
      if (!entries.includes(AMOEBA_BUNDLE_NAME)) {
        throw new AmoebaStagingError(`The update does not contain ${AMOEBA_BUNDLE_NAME}.`)
      }
      await runChecked(
        run,
        {
          program: '/usr/bin/ditto',
          args: [join(mountDir, AMOEBA_BUNDLE_NAME), stagedApp],
          timeoutMs: 300_000
        },
        'Could not copy the update out of its disk image'
      )
    } finally {
      await detach(run, mountDir)
    }
    await verifyStagedBundle(run, stagedApp, expectedVersion)
    return stagedApp
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true })
    throw error
  } finally {
    // Non-recursive: a volume that failed to detach must never have its contents deleted.
    await rmdir(mountDir).catch(() => {})
  }
}

async function verifyStagedBundle(
  run: StagingProcessRunner,
  stagedApp: string,
  expectedVersion: string
): Promise<void> {
  const plist = await runChecked(
    run,
    {
      program: '/usr/libexec/PlistBuddy',
      args: ['-c', 'Print CFBundleShortVersionString', join(stagedApp, 'Contents', 'Info.plist')],
      timeoutMs: 10_000
    },
    'Could not read the update version'
  )
  const stagedVersion = plist.stdout.trim()
  if (stagedVersion !== expectedVersion) {
    throw new AmoebaStagingError(
      `The update reports version ${stagedVersion || 'unknown'}, expected ${expectedVersion}.`
    )
  }
  await runChecked(
    run,
    {
      program: '/usr/bin/codesign',
      args: ['--verify', '--deep', '--strict', stagedApp],
      timeoutMs: 300_000
    },
    'The update failed code signature verification'
  )
}
