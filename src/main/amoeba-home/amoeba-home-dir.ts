import { homedir } from 'node:os'
import { join } from 'node:path'

// Orca owns ~/.orca and may run beside Amoeba, so Amoeba never reads or writes there.
export const AMOEBA_HOME_DIR_NAME = '.amoeba'
// Not `agent-hooks`: Orca treats any command naming `agent-hooks/<script>` as its own and sweeps it.
export const AMOEBA_HOOKS_DIR_NAME = 'hooks'
/** Home-relative POSIX path every managed hook command and matcher names. */
export const AMOEBA_HOOKS_RELATIVE_DIR = `${AMOEBA_HOME_DIR_NAME}/${AMOEBA_HOOKS_DIR_NAME}`

/** Keybindings, integration credentials, and headless server data. */
export function getAmoebaHomeDir(home: string = homedir()): string {
  return join(home, AMOEBA_HOME_DIR_NAME)
}

export function getAmoebaHooksDir(home: string = homedir()): string {
  return join(home, AMOEBA_HOME_DIR_NAME, AMOEBA_HOOKS_DIR_NAME)
}

export function getAmoebaHookScriptPath(scriptFileName: string): string {
  return join(getAmoebaHooksDir(), scriptFileName)
}

/** POSIX path of a managed hook file under a remote or redirected runtime home. */
export function getRemoteAmoebaHookScriptPath(remoteHome: string, scriptFileName: string): string {
  return `${remoteHome.replace(/\/+$/, '')}/${AMOEBA_HOOKS_RELATIVE_DIR}/${scriptFileName}`
}
