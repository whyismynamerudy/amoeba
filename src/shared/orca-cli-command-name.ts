export const AMOEBA_CLI_COMMAND_NAME = 'amoeba'

/** Names earlier builds registered (`orca-ide` on Linux); only cleanup and compatibility read these. */
export const LEGACY_CLI_COMMAND_NAMES = ['orca', 'orca-ide'] as const

export function getOrcaCliCommandNameForPlatform(platform: NodeJS.Platform): string {
  return platform === 'win32' ? `${AMOEBA_CLI_COMMAND_NAME}.cmd` : AMOEBA_CLI_COMMAND_NAME
}
