import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, link, lstat, readFile, rename, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Earlier headless serve builds published this marked regular file as `~/.local/bin/orca`.
const DISPATCHER_MARKER = '# orca-serve-bare-orca-dispatcher'

/** Removes the legacy bare `orca` dispatcher only when it carries our marker; anything else stays. */
export async function retireLinuxBareOrcaDispatcher(homePath = homedir()): Promise<boolean> {
  const dispatcherPath = join(homePath, '.local', 'bin', 'orca')
  if (!(await isOwnedDispatcher(dispatcherPath))) {
    return false
  }
  // Rename first so a concurrently replaced foreign command is restored rather than deleted.
  const displacedPath = join(
    dirname(dispatcherPath),
    `.orca-retired-dispatcher-${process.pid}-${randomUUID()}`
  )
  try {
    await rename(dispatcherPath, displacedPath)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return false
    }
    throw error
  }
  if (!(await isOwnedDispatcher(displacedPath))) {
    if (await publishIfVacant(displacedPath, dispatcherPath)) {
      await unlink(displacedPath)
    }
    return false
  }
  await unlink(displacedPath)
  return true
}

async function isOwnedDispatcher(dispatcherPath: string): Promise<boolean> {
  try {
    return (
      (await lstat(dispatcherPath)).isFile() &&
      (await readFile(dispatcherPath, 'utf8')).split('\n')[1] === DISPATCHER_MARKER
    )
  } catch {
    return false
  }
}

async function publishIfVacant(sourcePath: string, destinationPath: string): Promise<boolean> {
  try {
    await link(sourcePath, destinationPath)
    return true
  } catch (error) {
    if (hasErrorCode(error, 'EEXIST')) {
      return false
    }
  }
  try {
    await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL)
    return true
  } catch (error) {
    if (hasErrorCode(error, 'EEXIST')) {
      return false
    }
    throw error
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
