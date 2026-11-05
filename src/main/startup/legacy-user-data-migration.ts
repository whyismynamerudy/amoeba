import { existsSync, readdirSync, renameSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  APP_USER_DATA_DIR_NAME,
  hasProfile,
  LEGACY_APP_USER_DATA_DIR_NAME
} from '../../shared/app-user-data-dir'

/**
 * Move the Orca-era userData folder to Amoeba's before anything opens it.
 * Never overwrites: entries already in Amoeba's folder win, and leftovers stay in the old folder.
 */
export function migrateLegacyUserDataFolder(appDataRoot: string): void {
  const current = join(appDataRoot, APP_USER_DATA_DIR_NAME)
  const legacy = join(appDataRoot, LEGACY_APP_USER_DATA_DIR_NAME)
  if (!existsSync(legacy) || hasProfile(current)) {
    return
  }
  try {
    if (!existsSync(current) || readdirSync(current).length === 0) {
      // Whole-folder rename is atomic; Electron may have left an empty folder behind.
      if (existsSync(current)) {
        rmdirSync(current)
      }
      renameSync(legacy, current)
      return
    }
    for (const entry of readdirSync(legacy)) {
      if (!existsSync(join(current, entry))) {
        renameSync(join(legacy, entry), join(current, entry))
      }
    }
  } catch (error) {
    console.warn('[startup] Could not move the Orca data folder to Amoeba', error)
  }
}
