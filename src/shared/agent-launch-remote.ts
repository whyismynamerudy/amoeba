import type { Repo } from './repo-types'
import { getRepoSshConnectionId } from './execution-host'

/** SSH file owners use the remote server's own CLI. Resolve executionHostId over stale connectionId; runtime hosts are remote only with nested SSH. Local-PTY routing uses getSshTargetIdForExecutionHost; already-resolved launch connections need no re-derivation. */
export function repoIsRemote(repo: Pick<Repo, 'connectionId' | 'executionHostId'>): boolean {
  return getRepoSshConnectionId(repo) !== null
}
