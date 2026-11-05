import { describe, expect, it } from 'vitest'
import {
  formatCreateProjectParentSummary,
  getCreateProjectDefaultParentAutoFill,
  getDefaultCreateProjectParent,
  joinCreateProjectPath
} from './create-project-defaults'

describe('create project defaults', () => {
  it('builds the POSIX default project parent', () => {
    expect(getDefaultCreateProjectParent('/Users/alice')).toBe('/Users/alice/amoeba/projects')
  })

  it('builds the Windows default project parent', () => {
    expect(getDefaultCreateProjectParent('C:\\Users\\alice')).toBe(
      'C:\\Users\\alice\\amoeba\\projects'
    )
  })

  it('derives the runtime project default from a resolved server home', () => {
    expect(getDefaultCreateProjectParent('/home/alice')).toBe('/home/alice/amoeba/projects')
  })

  it('joins path previews without mixing separators', () => {
    expect(joinCreateProjectPath('/home/alice/amoeba/projects', 'demo')).toBe(
      '/home/alice/amoeba/projects/demo'
    )
    expect(joinCreateProjectPath('C:\\Users\\alice\\amoeba\\projects', 'demo')).toBe(
      'C:\\Users\\alice\\amoeba\\projects\\demo'
    )
  })

  it('auto-fills only the first empty local create step', () => {
    expect(
      getCreateProjectDefaultParentAutoFill({
        step: 'create',
        createParent: '',
        activeRuntimeEnvironmentId: null,
        defaultParent: '/Users/alice/amoeba/projects',
        createStepAutoFilled: false
      })
    ).toEqual({ parent: '/Users/alice/amoeba/projects' })
    expect(
      getCreateProjectDefaultParentAutoFill({
        step: 'create',
        createParent: '/tmp/project',
        activeRuntimeEnvironmentId: null,
        defaultParent: '/Users/alice/amoeba/projects',
        createStepAutoFilled: false
      })
    ).toBeNull()
    expect(
      getCreateProjectDefaultParentAutoFill({
        step: 'create',
        createParent: '',
        activeRuntimeEnvironmentId: null,
        defaultParent: '/Users/alice/amoeba/projects',
        createStepAutoFilled: true
      })
    ).toBeNull()
  })

  it('does not apply a local default while a runtime environment is active', () => {
    expect(
      getCreateProjectDefaultParentAutoFill({
        step: 'create',
        createParent: '',
        activeRuntimeEnvironmentId: 'env-1',
        defaultParent: '/Users/alice/amoeba/projects',
        createStepAutoFilled: false
      })
    ).toBeNull()
  })

  it('uses a short local summary only for the local default parent', () => {
    expect(
      formatCreateProjectParentSummary({
        parent: '/Users/alice/amoeba/projects',
        defaultParent: '/Users/alice/amoeba/projects'
      })
    ).toBe('~/amoeba/projects')
    expect(
      formatCreateProjectParentSummary({
        parent: '/home/alice/amoeba/projects',
        defaultParent: '/home/alice/amoeba/projects'
      })
    ).toBe('~/amoeba/projects')
    expect(
      formatCreateProjectParentSummary({
        parent: 'C:\\Users\\alice\\amoeba\\projects',
        defaultParent: 'C:\\Users\\alice\\amoeba\\projects'
      })
    ).toBe('~/amoeba/projects')
    expect(
      formatCreateProjectParentSummary({
        parent: '',
        defaultParent: '',
        runtimeEnvironmentId: 'env-1'
      })
    ).toBe('host folder not selected')
    expect(
      formatCreateProjectParentSummary({
        parent: '/Users/alice/amoeba/projects',
        defaultParent: '/Users/alice/amoeba/projects',
        isRemoteHost: true
      })
    ).toBe('/Users/alice/amoeba/projects')
    expect(
      formatCreateProjectParentSummary({
        parent: '',
        defaultParent: '',
        isRemoteHost: true
      })
    ).toBe('host folder not selected')
  })

  it('keeps a configured Workspace Directory verbatim in the summary', () => {
    expect(
      formatCreateProjectParentSummary({
        parent: 'J:\\PROJECTS',
        defaultParent: 'J:\\PROJECTS'
      })
    ).toBe('J:\\PROJECTS')
    expect(
      formatCreateProjectParentSummary({
        parent: '/data/amoeba/projects',
        defaultParent: '/data/amoeba/projects'
      })
    ).toBe('/data/amoeba/projects')
    expect(
      formatCreateProjectParentSummary({
        parent: 'D:\\code\\amoeba\\projects',
        defaultParent: 'D:\\code\\amoeba\\projects'
      })
    ).toBe('D:\\code\\amoeba\\projects')
  })
})
