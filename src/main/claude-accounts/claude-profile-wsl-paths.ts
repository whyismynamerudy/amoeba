import { basename, posix } from 'node:path'
import { describeClaudeProfile, type ClaudeProfileDescriptor } from './claude-profile-paths'

// share/orca belongs to Orca, which may run beside Amoeba in the same guest.
const WSL_DATA_ROOT = '.local/share/amoeba'

export function wslClaudeProfile(
  guestHome: string,
  distro: string,
  accountId: string
): { dataRoot: string; profile: ClaudeProfileDescriptor } {
  const dataRoot = posix.join(guestHome, WSL_DATA_ROOT)
  const profile = describeClaudeProfile(dataRoot, accountId, {
    executionHostId: 'local',
    runtime: 'wsl',
    distro
  })
  return { dataRoot, profile }
}

/** Keep pointers separate per build; the shell expands guest-home-relative paths without a WSL query. */
export function wslClaudeProfilePointer(hostDataRoot: string): string {
  const build = basename(hostDataRoot).replace(/[^\w.-]/g, '_')
  return `${WSL_DATA_ROOT}/claude-profiles/selected-wsl-${build}`
}

/** Legacy layouts contain no managed login and return null. */
export function savedWslClaudeAccountHome(account: {
  id: string
  wslLinuxAuthPath?: string | null
}): string | null {
  const home = account.wslLinuxAuthPath
  return home?.endsWith(`/claude-profiles/${account.id}/home`) ? home : null
}
