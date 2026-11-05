import { RuntimeClientError } from '../../runtime-client'

/** Undefined means `amoeba`, the server default, so pre-rename servers never see a value they reject. */
export function resolveCompatibilityCliCommand(): 'amoeba-dev' | 'orca-ide' | undefined {
  const configured = process.env.ORCA_CLI_COMMAND
  return configured === 'amoeba-dev' || configured === 'orca-ide' ? configured : undefined
}

export function resolvePackagedWindowsCompatibilityCommand(): 'amoeba' | 'orca-ide' | undefined {
  if (process.env.ORCA_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  // `orca-ide` arrives only from a WSL wrapper registered before the rename.
  const command = process.env.ORCA_CLI_COMMAND
  if (command === 'amoeba' || command === 'orca-ide') {
    return command
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'The packaged Amoeba launcher did not provide a valid resume command. No question was created.'
  )
}

export async function flushOrchestrationStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function isDevCliInvocation(): boolean {
  return (
    process.env.ORCA_DEV_CLI_INVOCATION === '1' ||
    (process.env.ORCA_USER_DATA_PATH?.includes('amoeba-dev') ?? false)
  )
}
