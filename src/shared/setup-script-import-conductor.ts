import { parse as parseToml } from 'smol-toml'
import { isRecord } from './agent-status-child-work-value-guards'
import type { SetupScriptImportCandidate, SetupScriptImportFileRead } from './setup-script-imports'
import {
  normalizeSetupScriptImportCommand,
  pushSetupScriptImportUnsupportedField
} from './setup-script-import-command-limits'

const CONDUCTOR_SETTINGS_PATH = '.conductor/settings.toml'
const CONDUCTOR_LOCAL_SETTINGS_PATH = '.conductor/settings.local.toml'
const CONDUCTOR_LEGACY_CONFIG_PATH = 'conductor.json'

type ConductorScripts = { setup: string; archive: string; unsupportedFields: string[] }

/** Conductor's repo settings: `.conductor/settings.toml` (machine-local file wins per key),
 *  else the legacy `conductor.json` it replaced. */
export async function inspectConductorConfig(
  readFile: SetupScriptImportFileRead
): Promise<SetupScriptImportCandidate | null> {
  return (await inspectConductorSettingsToml(readFile)) ?? inspectConductorLegacyJson(readFile)
}

async function inspectConductorSettingsToml(
  readFile: SetupScriptImportFileRead
): Promise<SetupScriptImportCandidate | null> {
  const files: string[] = []
  const layers: Record<string, unknown>[] = []
  // Shared first so the machine-local layer overrides it.
  for (const path of [CONDUCTOR_SETTINGS_PATH, CONDUCTOR_LOCAL_SETTINGS_PATH]) {
    const settings = parseTomlTable(await readFile(path))
    if (settings) {
      files.push(path)
      layers.push(settings)
    }
  }
  const scripts = layers.reduce<ConductorScripts>(
    (merged, layer) => mergeConductorTomlLayer(merged, layer),
    { setup: '', archive: '', unsupportedFields: [] }
  )
  return scripts.setup ? toCandidate(files, scripts) : null
}

function mergeConductorTomlLayer(
  merged: ConductorScripts,
  layer: Record<string, unknown>
): ConductorScripts {
  const scripts = asRecord(layer.scripts)
  const unsupportedFields = [...merged.unsupportedFields]
  const flag = (field: string): void => {
    if (!unsupportedFields.includes(field)) {
      pushSetupScriptImportUnsupportedField(unsupportedFields, field)
    }
  }
  if (layer.file_include_globs !== undefined) {
    flag('file_include_globs')
  }
  if (scripts?.run !== undefined) {
    flag('scripts.run')
  }
  if (scripts?.run_mode !== undefined) {
    flag('scripts.run_mode')
  }
  return {
    setup: normalizeSetupScriptImportCommand(scripts?.setup) || merged.setup,
    archive: normalizeSetupScriptImportCommand(scripts?.archive) || merged.archive,
    unsupportedFields
  }
}

async function inspectConductorLegacyJson(
  readFile: SetupScriptImportFileRead
): Promise<SetupScriptImportCandidate | null> {
  const config = parseJsonObject(await readFile(CONDUCTOR_LEGACY_CONFIG_PATH))
  const scripts = asRecord(config?.scripts)
  if (!config || !scripts) {
    return null
  }
  const setup = normalizeSetupScriptImportCommand(scripts.setup)
  if (!setup) {
    return null
  }
  const unsupportedFields = ['enterpriseDataPrivacy', 'runScriptMode'].filter(
    (field) => config[field] !== undefined
  )
  for (const field of ['run', 'teardown'] as const) {
    if (normalizeSetupScriptImportCommand(scripts[field])) {
      unsupportedFields.push(`scripts.${field}`)
    }
  }
  return toCandidate([CONDUCTOR_LEGACY_CONFIG_PATH], {
    setup,
    archive: normalizeSetupScriptImportCommand(scripts.archive),
    unsupportedFields
  })
}

function toCandidate(files: string[], scripts: ConductorScripts): SetupScriptImportCandidate {
  return {
    provider: 'conductor',
    label: 'Conductor',
    files,
    setup: scripts.setup,
    archive: scripts.archive || undefined,
    unsupportedFields: scripts.unsupportedFields
  }
}

function parseTomlTable(content: string | null): Record<string, unknown> | null {
  if (content === null) {
    return null
  }
  try {
    return asRecord(parseToml(content))
  } catch {
    return null
  }
}

function parseJsonObject(content: string | null): Record<string, unknown> | null {
  if (content === null) {
    return null
  }
  try {
    return asRecord(JSON.parse(content))
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}
