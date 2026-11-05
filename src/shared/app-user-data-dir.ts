import { join } from 'node:path'

/** Amoeba's own userData folder; never shared with Orca's `orca` folder so both apps can coexist. */
export const APP_USER_DATA_DIR_NAME = 'amoeba'

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

export function getPackagedUserDataPath(appDataRoot: string): string {
  return join(appDataRoot, APP_USER_DATA_DIR_NAME)
}
