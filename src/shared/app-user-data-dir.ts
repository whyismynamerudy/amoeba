import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** The packaged app's userData folder under the OS app-data root (matches Electron's app name). */
export const APP_USER_DATA_DIR_NAME = 'amoeba'
/** Orca-era folder; the packaged app moves it to APP_USER_DATA_DIR_NAME on first launch. */
export const LEGACY_APP_USER_DATA_DIR_NAME = 'orca'

/** Electron's per-user app-data root, or null on Windows when APPDATA is unset. */
export function getAppDataRoot(
  platform: NodeJS.Platform,
  homeDir: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (platform === 'darwin') {
    return join(homeDir, 'Library', 'Application Support')
  }
  if (platform === 'win32') {
    return env.APPDATA || null
  }
  return env.XDG_CONFIG_HOME || join(homeDir, '.config')
}

/** Prefer Amoeba's folder; read the Orca-era one only while it is the sole profile (e.g. an older app is running). */
export function resolvePackagedUserDataPath(appDataRoot: string): string {
  const current = join(appDataRoot, APP_USER_DATA_DIR_NAME)
  const legacy = join(appDataRoot, LEGACY_APP_USER_DATA_DIR_NAME)
  return !hasProfile(current) && hasProfile(legacy) ? legacy : current
}

/** A folder holds a real profile once the profile index or profiles directory exists. */
export function hasProfile(userDataPath: string): boolean {
  return (
    existsSync(join(userDataPath, 'profiles')) ||
    existsSync(join(userDataPath, 'orca-profile-index.json'))
  )
}
