import { isOrcaSessionId, type OrcaSessionId } from './orca-session-address'

/** A literal Amoeba session id for a test, checked by the same predicate production uses. */
export function testOrcaSessionId(id: string): OrcaSessionId {
  if (!isOrcaSessionId(id)) {
    throw new Error(`Not an Amoeba session id: ${id}`)
  }
  return id
}
