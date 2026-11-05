import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from '../../../shared/constants'
import { migrateLegacyOrcaWorkspaceDir } from './amoeba-workspace-dir-migration'

const home = '/Users/me'

describe('migrateLegacyOrcaWorkspaceDir', () => {
  it('moves the untouched Orca root to Amoeba and keeps it as a known layout', () => {
    const settings = {
      ...getDefaultSettings(home),
      workspaceDir: '/Users/me/orca/workspaces/',
      nestWorkspaces: false
    }

    expect(migrateLegacyOrcaWorkspaceDir(settings, home)).toEqual({
      workspaceDir: '/Users/me/amoeba/workspaces',
      workspaceDirHistory: [{ path: '/Users/me/orca/workspaces/', nestWorkspaces: false }]
    })
  })

  it('leaves a directory the user chose alone', () => {
    const settings = { ...getDefaultSettings(home), workspaceDir: '/Volumes/dev/worktrees' }

    expect(migrateLegacyOrcaWorkspaceDir(settings, home)).toBeNull()
  })
})
