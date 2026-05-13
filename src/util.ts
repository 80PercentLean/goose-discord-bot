import { PermissionFlagsBits } from "discord-api-types/v10"

/**
 * Checks if permissions has administrator privileges enabled.
 * @param permissions Permissions string
 * @returns True if permissions has administrator privileges enabled, false otherwise
 */
export const isAdmin = (permissions?: string) => {
  if (!permissions) {
    return false
  }

  const p = BigInt(permissions)
  return (
    (p & PermissionFlagsBits.Administrator) ===
    PermissionFlagsBits.Administrator
  )
}

/**
 * Checks if roles include a team member role.
 * @param roles Roles
 * @returns True if roles include a team member role, false otherwise
 */
export const isTeamMember = (roles?: string[]) => {
  if (!Array.isArray(roles)) {
    return false
  }

  const CUPERTINO_POGO = "1355277649139859565" as const
  const WILD_GOOSE = "1457214376661487698" as const

  for (const r of roles) {
    if (r === CUPERTINO_POGO || r == WILD_GOOSE) {
      return true
    }
  }

  return false
}
