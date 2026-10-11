import { Command, Modal, Option, type createRest } from 'discord-hono'

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
  attachments?: {
    id: string
    content_type?: string
  }[]
  embeds?: {
    image?: unknown
    thumbnail?: unknown
  }[]
  content?: string
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
      continue
    }

    break
  }

  return emojis
}

const isImageMessage = (msg: DiscordMessage): boolean => {
  if (msg.attachments?.some((att) => att.content_type?.startsWith('image/'))) {
    return true
  }
  if (msg.embeds?.some((emb) => emb.image || emb.thumbnail)) {
    return true
  }
  if (
    msg.content &&
    /\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i.test(msg.content.trim())
  ) {
    return true
  }
  return false
}

const findLatestImageMessage = async (
  c: { rest: RestClient },
  channelId: string,
  userId?: string,
): Promise<DiscordMessage | undefined> => {
  const msgsRes = await (c.rest as RestClient)(
    'GET',
    '/channels/{channel.id}/messages',
    [channelId, { limit: 50 }],
  )
  if (!msgsRes.ok) return undefined
  const msgs = (await msgsRes.json()) as DiscordMessage[]
  return msgs.find(
    (m) => (!userId || m.author?.id === userId) && isImageMessage(m),
  )
}

const applyRoleAndReactions = async (
  c: {
    rest: RestClient
    flags: (...flags: ('EPHEMERAL' | 'SUPPRESS_EMBEDS')[]) => {
      res: (msg: string) => Response
    }
  },
  guildId: string,
  channelId: string,
  targetUserId: string,
  selectedRoleId: string,
  targetMessage?: DiscordMessage,
  react = true,
) => {
  const rolesRes = await c.rest('GET', '/guilds/{guild.id}/roles', [guildId])
  if (!rolesRes.ok) {
    return c.flags('EPHEMERAL').res('Failed to fetch server roles.')
  }

  const allRoles = (await rolesRes.json()) as DiscordRole[]
  const selectedRole = allRoles.find((r) => r.id === selectedRoleId)
  if (!selectedRole) {
    return c.flags('EPHEMERAL').res('Role not found.')
  }

  const applyRes = await c.rest(
    'PUT',
    '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    [guildId, targetUserId, selectedRoleId],
  )
  if (!applyRes.ok) {
    return c.flags('EPHEMERAL').res('Failed to apply role.')
  }

  if (react && targetMessage) {
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
}

export const command_addRole = factory.autocomplete(
  new Command(
    'add_role',
    'Assign a role to a user or message author and react with role emojis.',
  ).options(
    new Option('role', 'Role to assign').autocomplete().required(),
    new Option('message', 'Target message ID or link (optional)'),
    new Option('user', 'Target user to apply role to (optional)', 'User'),
    new Option(
      'react',
      'React to target or latest image (optional)',
      'Boolean',
    ),
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

    const reactOption = c.var.react
    const shouldReact = reactOption !== undefined ? Boolean(reactOption) : true

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

    const explicitUserId = c.var.user

    if (!targetMessage && explicitUserId && shouldReact) {
      targetMessage = await findLatestImageMessage(c, channelId, explicitUserId)
    }

    if (!targetMessage && !explicitUserId) {
      targetMessage = await findLatestImageMessage(c, channelId)
    }

    if (!targetMessage && !explicitUserId) {
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

    const targetUserId = explicitUserId ?? targetMessage?.author?.id

    if (!targetUserId) {
      return c.flags('EPHEMERAL').res('Target user not found.')
    }

    return applyRoleAndReactions(
      c,
      guildId,
      channelId,
      targetUserId,
      selectedRoleId,
      targetMessage,
      shouldReact,
    )
  },
)

export const contextMenu_addRole = factory.command(
  new Command('Add Role').type(3),
  async (c) => {
    if (!validateUserPermissions(c.interaction)) {
      return c.flags('EPHEMERAL').res('Unauthorized.')
    }

    const interactionRaw = c.interaction as {
      data?: {
        target_id?: string
        resolved?: {
          messages?: Record<string, DiscordMessage>
        }
      }
    }

    const targetId = interactionRaw.data?.target_id
    const targetMsg = targetId
      ? interactionRaw.data?.resolved?.messages?.[targetId]
      : undefined
    const authorId = targetMsg?.author?.id ?? ''

    return c.resModal({
      custom_id: `modal_add_role;${targetId ?? ''};${authorId}`,
      title: 'Add Role',
      components: [
        {
          type: 18,
          label: 'Role to assign',
          component: {
            type: 6,
            custom_id: 'role_select_native',
            placeholder: 'Select a role...',
          },
        },
        {
          type: 18,
          label: 'React with emojis and medal',
          component: {
            type: 23,
            custom_id: 'react_checkbox',
            default: true,
          },
        },
      ],
    } as never)
  },
)

export const modal_addRole = factory.modal(
  new Modal('modal_add_role', 'Add Role'),
  async (c) => {
    if (!validateUserPermissions(c.interaction)) {
      return c.flags('EPHEMERAL').res('Unauthorized.')
    }

    const channelId = c.interaction.channel_id ?? c.interaction.channel?.id
    const guildId = c.interaction.guild_id ?? c.env.DISCORD_TEST_GUILD_ID

    if (!channelId || !guildId) {
      return c.flags('EPHEMERAL').res('Failed to identify server or channel.')
    }

    const customValue = c.ref.custom_value ?? ''
    const [targetMsgId, authorId] = customValue.split(';')

    const interactionData = (
      c.interaction as {
        data?: {
          components?: {
            component?: {
              custom_id?: string
              value?: unknown
              values?: string[]
            }
          }[]
        }
      }
    ).data

    let selectedRoleId: string | undefined
    let shouldReact = true

    const vars = c.var as Record<string, unknown>
    if (Array.isArray(vars.role_select_native)) {
      selectedRoleId = vars.role_select_native[0] as string
    } else if (typeof vars.role_select_native === 'string') {
      selectedRoleId = vars.role_select_native
    }

    if (typeof vars.react_checkbox === 'boolean') {
      shouldReact = vars.react_checkbox
    }

    if (!selectedRoleId && interactionData?.components) {
      for (const row of interactionData.components) {
        const comp = row.component
        if (comp?.custom_id === 'role_select_native') {
          selectedRoleId = comp.values?.[0]
        } else if (comp?.custom_id === 'react_checkbox') {
          shouldReact = Boolean(comp.value)
        }
      }
    }

    if (!selectedRoleId) {
      return c.flags('EPHEMERAL').res('Role not specified.')
    }

    let targetMessage: DiscordMessage | undefined
    if (targetMsgId) {
      const msgRes = await c.rest(
        'GET',
        '/channels/{channel.id}/messages/{message.id}',
        [channelId, targetMsgId],
      )
      if (msgRes.ok) {
        targetMessage = (await msgRes.json()) as DiscordMessage
      }
    }

    const targetUserId = authorId || targetMessage?.author?.id
    if (!targetUserId) {
      return c.flags('EPHEMERAL').res('Target user not found.')
    }

    return applyRoleAndReactions(
      c,
      guildId,
      channelId,
      targetUserId,
      selectedRoleId,
      targetMessage,
      shouldReact,
    )
  },
)
