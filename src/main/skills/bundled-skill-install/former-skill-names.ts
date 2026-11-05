import { basename, dirname, join } from 'node:path'
import type { BundledSkillCleanup } from '../../../shared/bundled-skill-plan'
import type { BundledSkillSource } from './bundled-skill-sources'
import { classifyBundledSkillPath } from './classify'
import type { BundledSkillFilesystem } from './filesystem'
import { bundledSkillLinkPointsAt } from './targets'

/** Every source when unnamed; older clients and installed stubs may still name a renamed skill by a former name. */
export function selectBundledSkillSources(input: {
  names?: readonly string[]
  sources: readonly BundledSkillSource[]
}): BundledSkillSource[] {
  if (!input.names) {
    return [...input.sources]
  }
  const selected = new Set<BundledSkillSource>()
  for (const name of input.names) {
    const source =
      input.sources.find((candidate) => candidate.name === name) ??
      input.sources.find((candidate) => candidate.formerNames?.includes(name))
    if (!source) {
      throw new Error(`bundled-skill-unknown: ${name}`)
    }
    selected.add(source)
  }
  return [...selected]
}

export function isFormerBundledSkillPath(source: BundledSkillSource, path: string): boolean {
  return source.formerNames?.includes(basename(path)) ?? false
}

/** Literal and real paths of the new name's shared copy; former-name links into it are ours. */
export type FormerNameSharedTarget = { path: string; realPath: string }

/**
 * Untouched Amoeba-built copies a renamed skill left under its former names, and agent links into
 * such a shared copy. Edited content and upstream Orca's same-named skills never match, so they stay.
 */
export async function planFormerNameRetirement(
  filesystem: BundledSkillFilesystem,
  source: BundledSkillSource,
  digest: string,
  rootPath: string,
  shared: FormerNameSharedTarget | null
): Promise<BundledSkillCleanup[]> {
  const cleanup: BundledSkillCleanup[] = []
  for (const formerName of source.formerNames ?? []) {
    const path = join(rootPath, formerName)
    const { folderClass, observed } = await classifyBundledSkillPath(
      filesystem,
      path,
      source,
      digest
    )
    const retire =
      folderClass === 'current' ||
      folderClass === 'released' ||
      (observed.kind === 'link' &&
        shared !== null &&
        (await linksToRetirableSharedCopy(filesystem, source, digest, path, observed.target, {
          path: join(dirname(shared.path), formerName),
          realPath: join(dirname(shared.realPath), formerName)
        })))
    if (retire) {
      cleanup.push({ path, action: 'delete', observed })
    }
  }
  return cleanup
}

async function linksToRetirableSharedCopy(
  filesystem: BundledSkillFilesystem,
  source: BundledSkillSource,
  digest: string,
  linkPath: string,
  rawTarget: string,
  formerShared: FormerNameSharedTarget
): Promise<boolean> {
  if (!(await bundledSkillLinkPointsAt(filesystem, linkPath, rawTarget, formerShared.realPath))) {
    return false
  }
  const { folderClass } = await classifyBundledSkillPath(
    filesystem,
    formerShared.path,
    source,
    digest
  )
  return folderClass === 'current' || folderClass === 'released'
}
