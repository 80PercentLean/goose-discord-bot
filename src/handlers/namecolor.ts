import { Command, Option, type createRest } from 'discord-hono'

import { factory } from '../init'

type RestClient = ReturnType<typeof createRest>

export interface DiscordRole {
  id: string
  name: string
  color: number
  position: number
  colors?: {
    primary_color?: number | null
    secondary_color?: number | null
    tertiary_color?: number | null
  }
}

const roleCache = new Map<string, { roles: DiscordRole[]; expires: number }>()

const toHex = (n: number) => `#${n.toString(16).padStart(6, '0').toUpperCase()}`

export const getRoleColors = (role: DiscordRole): number[] => {
  if (role.colors?.primary_color) {
    return [
      role.colors.primary_color,
      role.colors.secondary_color,
      role.colors.tertiary_color,
    ].filter((c): c is number => typeof c === 'number' && c > 0)
  }
  return role.color ? [role.color] : []
}

export const getRoleColorName = (role: DiscordRole): string => {
  const colors = getRoleColors(role)
  return `[Color] ${colors.map(toHex).join(' - ')}`
}

const getGuildRoles = async (
  c: { rest: RestClient },
  guildId: string,
  bypassCache = false,
): Promise<DiscordRole[]> => {
  const now = Date.now()
  const cached = roleCache.get(guildId)
  if (!bypassCache && cached && cached.expires > now) {
    return cached.roles
  }
  const res = await c.rest('GET', '/guilds/{guild.id}/roles', [guildId])
  if (!res.ok) return cached?.roles ?? []
  const roles = (await res.json()) as DiscordRole[]
  roleCache.set(guildId, { roles, expires: now + 15_000 })
  return roles
}

const cleanupUnusedRole = async (
  c: { rest: RestClient },
  guildId: string,
  roleId: string,
  excludeUserId?: string,
) => {
  const membersRes = await c.rest('GET', '/guilds/{guild.id}/members', [
    guildId,
    { limit: 1000 },
  ])
  if (!membersRes.ok) return
  const members = (await membersRes.json()) as {
    user?: { id: string }
    roles?: string[]
  }[]
  const inUse = members.some(
    (m) =>
      m.user?.id !== excludeUserId &&
      Array.isArray(m.roles) &&
      m.roles.includes(roleId),
  )
  if (!inUse) {
    await c.rest('DELETE', '/guilds/{guild.id}/roles/{role.id}', [
      guildId,
      roleId,
    ])
    roleCache.delete(guildId)
  }
}

export const command_namecolor = factory.autocomplete(
  new Command('namecolor', 'Set or remove your name color role.').options(
    new Option('color', 'Role to copy name color from')
      .autocomplete()
      .required(),
  ),
  async (c) => {
    const guildId = c.interaction.guild_id ?? c.env.DISCORD_TEST_GUILD_ID
    const userRoles = c.interaction.member?.roles ?? []
    const query = (c.focused?.value as string)?.toLowerCase() ?? ''

    if (!guildId) {
      return c.resAutocomplete({ choices: [{ name: 'None', value: 'none' }] })
    }

    const allRoles = await getGuildRoles(c, guildId)
    const userColorRoles = allRoles.filter(
      (r) =>
        userRoles.includes(r.id) &&
        !r.name.startsWith('[Color] ') &&
        getRoleColors(r).length > 0,
    )

    const choices = [
      { name: 'None', value: 'none' },
      ...userColorRoles.map((r) => ({
        name: r.name,
        value: r.id,
      })),
    ].filter(({ name }) => name.toLowerCase().includes(query))

    return c.resAutocomplete({ choices: choices.slice(0, 25) })
  },
  async (c) => {
    const guildId = c.interaction.guild_id ?? c.env.DISCORD_TEST_GUILD_ID
    const userId = c.interaction.member?.user?.id
    const userRoles = c.interaction.member?.roles ?? []

    if (!guildId || !userId) {
      return c.flags('EPHEMERAL').res('Failed to identify user or server.')
    }

    const allRoles = await getGuildRoles(c, guildId, true)
    const userColorRoles = allRoles.filter(
      (r) => r.name.startsWith('[Color] ') && userRoles.includes(r.id),
    )

    const selectedRoleId = c.var.color

    if (!selectedRoleId || selectedRoleId === 'none') {
      if (userColorRoles.length === 0) {
        return c.flags('EPHEMERAL').res("You don't have a name color role set.")
      }
      for (const role of userColorRoles) {
        await c.rest(
          'DELETE',
          '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
          [guildId, userId, role.id],
        )
        await cleanupUnusedRole(c, guildId, role.id, userId)
      }
      return c.flags('EPHEMERAL').res('Removed your name color role.')
    }

    const sourceRole = allRoles.find(
      (r) =>
        r.id === selectedRoleId &&
        userRoles.includes(r.id) &&
        !r.name.startsWith('[Color] '),
    )

    if (!sourceRole) {
      return c
        .flags('EPHEMERAL')
        .res("You don't have that role or it cannot be used.")
    }

    const colors = getRoleColors(sourceRole)
    if (colors.length === 0) {
      return c.flags('EPHEMERAL').res("Selected role doesn't have a color.")
    }

    const targetRoleName = getRoleColorName(sourceRole)

    if (userColorRoles.some((r) => r.name === targetRoleName)) {
      return c
        .flags('EPHEMERAL')
        .res('Your name color is already set to this color.')
    }

    let targetRole = allRoles.find((r) => r.name === targetRoleName)

    if (!targetRole) {
      const createBody: Record<string, unknown> = {
        name: targetRoleName,
        color: colors[0],
      }
      if (sourceRole.colors?.primary_color) {
        createBody.colors = sourceRole.colors
      }

      const createRes = await c.rest(
        'POST',
        '/guilds/{guild.id}/roles',
        [guildId],
        createBody as never,
      )
      if (!createRes.ok) {
        return c.flags('EPHEMERAL').res('Failed to create name color role.')
      }
      targetRole = (await createRes.json()) as DiscordRole
      roleCache.delete(guildId)

      const botMemberRes = await c.rest(
        'GET',
        '/guilds/{guild.id}/members/{user.id}',
        [guildId, c.env.DISCORD_APPLICATION_ID],
      )
      if (botMemberRes.ok) {
        const botMember = (await botMemberRes.json()) as { roles?: string[] }
        const botRoles = allRoles.filter((r) => botMember.roles?.includes(r.id))
        const botMaxPos = Math.max(...botRoles.map((r) => r.position), 1)
        const newPos = Math.max(1, botMaxPos - 1)
        await c.rest('PATCH', '/guilds/{guild.id}/roles', [guildId], [
          { id: targetRole.id, position: newPos },
        ] as never)
      }
    }

    for (const oldRole of userColorRoles) {
      if (oldRole.id !== targetRole.id) {
        await c.rest(
          'DELETE',
          '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
          [guildId, userId, oldRole.id],
        )
        await cleanupUnusedRole(c, guildId, oldRole.id, userId)
      }
    }

    const res = await c.rest(
      'PUT',
      '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
      [guildId, userId, targetRole.id],
    )

    if (!res.ok) {
      return c.flags('EPHEMERAL').res('Failed to set name color role.')
    }

    return c
      .flags('EPHEMERAL')
      .res(`Set your name color to ${sourceRole.name}.`)
  },
)
