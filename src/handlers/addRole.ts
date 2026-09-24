import { Command, Option, type createRest } from 'discord-hono'

import { factory } from '../init'
import { validateUserPermissions } from './helper'

type RestClient = ReturnType<typeof createRest>

interface DiscordRole {
  id: string
  name: string
}

interface DiscordMessage {
  id: string
  author?: {
    id: string
  }
}

export const extractTrailingEmojis = (text: string): string[] => {
  const unicodeEmojiRegex = /\p{Extended_Pictographic}/u
  const emojis: string[] = []
  let remaining = text.trim()

  while (remaining.length > 0) {
    const customMatch = remaining.match(/<a?:([a-zA-Z0-9_]+:\d+)>$/)
    if (customMatch) {
      emojis.unshift(customMatch[1])
      remaining = remaining
        .slice(0, remaining.length - customMatch[0].length)
        .trim()
      continue
    }

    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
    const segments = [...segmenter.segment(remaining)]
    const lastSegment = segments[segments.length - 1]?.segment

    if (lastSegment && unicodeEmojiRegex.test(lastSegment)) {
      emojis.unshift(lastSegment)
      remaining = remaining
        .slice(0, remaining.length - lastSegment.length)
        .trim()
    } else {
      break
    }
  }

  return emojis
}

export const command_addRole = factory.autocomplete(
  new Command(
    'add_role',
    'Assign a role to a user or message author and react with role emojis.',
  ).options(
    new Option('role', 'Role to assign').autocomplete().required(),
    new Option('message', 'Target message ID or link (optional)'),
    new Option('user', 'Target user to apply role to (optional)', 'User'),
  ),
  async (c) => {
    const guildId = c.interaction.guild_id ?? c.env.DISCORD_TEST_GUILD_ID
    const query = (c.focused?.value as string)?.toLowerCase() ?? ''

    if (!guildId) {
      return c.resAutocomplete({ choices: [] })
    }

    const res = await c.rest('GET', '/guilds/{guild.id}/roles', [guildId])
    if (!res.ok) {
      return c.resAutocomplete({ choices: [] })
    }

    const roles = (await res.json()) as DiscordRole[]
    const choices = roles
      .filter(
        (r) =>
          r.id !== guildId &&
          r.name !== '@everyone' &&
          !r.name.startsWith('[Color] ') &&
          r.name.toLowerCase().includes(query),
      )
      .map((r) => ({ name: r.name, value: r.id }))
      .slice(0, 25)

    return c.resAutocomplete({ choices })
  },
  async (c) => {
    if (!validateUserPermissions(c.interaction)) {
      return c.flags('EPHEMERAL').res('Unauthorized.')
    }

    const channelId = c.interaction.channel_id ?? c.interaction.channel?.id
    const guildId = c.interaction.guild_id ?? c.env.DISCORD_TEST_GUILD_ID

    if (!channelId || !guildId) {
      return c.flags('EPHEMERAL').res('Failed to identify server or channel.')
    }

    const selectedRoleId = c.var.role
    if (!selectedRoleId) {
      return c.flags('EPHEMERAL').res('Role not specified.')
    }

    const rolesRes = await c.rest('GET', '/guilds/{guild.id}/roles', [guildId])
    if (!rolesRes.ok) {
      return c.flags('EPHEMERAL').res('Failed to fetch server roles.')
    }

    const allRoles = (await rolesRes.json()) as DiscordRole[]
    const selectedRole = allRoles.find((r) => r.id === selectedRoleId)
    if (!selectedRole) {
      return c.flags('EPHEMERAL').res('Role not found.')
    }

    const interactionRaw = c.interaction as {
      message?: DiscordMessage
      data?: { resolved?: { messages?: Record<string, DiscordMessage> } }
    }

    let targetMessage: DiscordMessage | undefined

    if (interactionRaw.message) {
      targetMessage = interactionRaw.message
    } else if (interactionRaw.data?.resolved?.messages) {
      const resolvedList = Object.values(interactionRaw.data.resolved.messages)
      if (resolvedList.length > 0) {
        targetMessage = resolvedList[0]
      }
    }

    if (!targetMessage && c.var.message) {
      const messageId =
        c.var.message.split('/').pop()?.trim() ?? c.var.message.trim()
      const msgRes = await c.rest(
        'GET',
        '/channels/{channel.id}/messages/{message.id}',
        [channelId, messageId],
      )
      if (msgRes.ok) {
        targetMessage = (await msgRes.json()) as DiscordMessage
      }
    }

    if (!targetMessage) {
      const msgsRes = await (c.rest as RestClient)(
        'GET',
        '/channels/{channel.id}/messages',
        [channelId, { limit: 1 }],
      )
      if (msgsRes.ok) {
        const msgs = (await msgsRes.json()) as DiscordMessage[]
        targetMessage = msgs[0]
      }
    }

    const explicitUserId = c.var.user
    const targetUserId = explicitUserId ?? targetMessage?.author?.id

    if (!targetUserId) {
      return c.flags('EPHEMERAL').res('Target user not found.')
    }

    const applyRes = await c.rest(
      'PUT',
      '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
      [guildId, targetUserId, selectedRoleId],
    )

    if (!applyRes.ok) {
      return c.flags('EPHEMERAL').res('Failed to apply role.')
    }

    if (targetMessage) {
      const emojis = extractTrailingEmojis(selectedRole.name)
      const allEmojis = [...emojis, '🏅']

      for (const emoji of allEmojis) {
        await c.rest(
          'PUT',
          '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me',
          [channelId, targetMessage.id, encodeURIComponent(emoji)],
        )
      }

      return c.flags('EPHEMERAL').res('Role applied and reactions added.')
    }

    return c.flags('EPHEMERAL').res('Role applied.')
  },
)
