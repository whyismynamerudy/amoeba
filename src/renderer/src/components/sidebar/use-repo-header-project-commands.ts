import { useCallback } from 'react'
import { useAppStore } from '@/store'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'

/** Project-header commands shared by the workspace sidebar and the task sidebar. */
export function useRepoHeaderProjectCommands(): {
  onOpenRepoSettings: (projectId: string, sectionId?: string) => void
  onOpenWorktreeVisibility: (repo: Repo) => void
  onRemoveProject: (repo: Repo) => void
} {
  const openModal = useAppStore((s) => s.openModal)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const onOpenRepoSettings = useCallback(
    (projectId: string, sectionId?: string) => {
      openSettingsTarget({ pane: 'repo', repoId: projectId, ...(sectionId ? { sectionId } : {}) })
      openSettingsPage()
    },
    [openSettingsPage, openSettingsTarget]
  )
  const onOpenWorktreeVisibility = useCallback(
    (repo: Repo) => {
      openModal('worktree-visibility', { repoId: repo.id, hostId: getRepoExecutionHostId(repo) })
    },
    [openModal]
  )
  const onRemoveProject = useCallback(
    (repo: Repo) => {
      openModal('confirm-remove-folder', {
        repoId: repo.id,
        displayName: repo.displayName,
        hostId: getRepoExecutionHostId(repo)
      })
    },
    [openModal]
  )
  return { onOpenRepoSettings, onOpenWorktreeVisibility, onRemoveProject }
}
