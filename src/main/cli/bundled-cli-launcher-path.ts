import { join } from 'node:path'
import { AMOEBA_CLI_COMMAND_NAME } from '../../shared/orca-cli-command-name'

// Keep path-only callers independent of cli-installer's Electron dependency.
export function getBundledLauncherPath(
  platform: NodeJS.Platform,
  resourcesPath: string
): string | null {
  if (platform === 'darwin' || platform === 'linux') {
    return join(resourcesPath, 'bin', AMOEBA_CLI_COMMAND_NAME)
  }
  if (platform === 'win32') {
    return join(resourcesPath, 'bin', `${AMOEBA_CLI_COMMAND_NAME}.exe`)
  }
  return null
}
