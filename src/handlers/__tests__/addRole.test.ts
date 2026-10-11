import { describe, expect, it, vi } from 'vitest'

import {
  command_addRole,
  contextMenu_addRole,
  extractTrailingEmojis,
  modal_addRole,
} from '../addRole'

describe('extractTrailingEmojis', () => {
  it('extracts single unicode emoji at the end', () => {
    expect(extractTrailingEmojis('Master 🏆')).toEqual(['🏆'])
  })

  it('extracts multiple unicode emojis at the end', () => {
    expect(extractTrailingEmojis('Legend 🥇 🥈 🥉')).toEqual(['🥇', '🥈', '🥉'])
  })

  it('extracts custom discord emojis', () => {
    expect(extractTrailingEmojis('Champion <:pika:123456>')).toEqual([
      'pika:123456',
    ])
  })

  it('extracts animated custom discord emojis', () => {
    expect(extractTrailingEmojis('VIP <a:fire:987654>')).toEqual([
      'fire:987654',
    ])
  })

  it('extracts mix of unicode and custom emojis at the end', () => {
    expect(extractTrailingEmojis('Ultimate 🎉 <:custom:111222> 🚀')).toEqual([
      '🎉',
      'custom:111222',
      '🚀',
    ])
  })

  it('returns empty array when there are no emojis at the end', () => {
    expect(extractTrailingEmojis('Server Admin')).toEqual([])
  })

  it('returns empty array when emoji is at the start or middle only', () => {
    expect(extractTrailingEmojis('⭐ Super Mod')).toEqual([])
    expect(extractTrailingEmojis('Super ⭐ Mod')).toEqual([])
  })
})

describe('command_addRole autocomplete', () => {
  const sampleRoles = [
    { id: '1', name: 'Member' },
    { id: '2', name: 'VIP 🌟' },
    { id: '3', name: 'Admin 👑' },
    { id: '4', name: '[Color] #FF0000' },
    { id: 'guild-123', name: '@everyone' },
  ]

  it('returns filtered role choices excluding @everyone and [Color] roles', async () => {
    const resAutocompleteMock = vi.fn((val: unknown) => val)
    const context = {
      interaction: {
        guild_id: 'guild-123',
      },
      env: {
        DISCORD_TEST_GUILD_ID: 'guild-123',
      },
      focused: {
        value: '',
      },
      resAutocomplete: resAutocompleteMock,
      rest: vi.fn(async () => ({
        ok: true,
        json: async () => sampleRoles,
      })),
    }

    await command_addRole.autocomplete(context as never)

    expect(resAutocompleteMock).toHaveBeenCalledWith({
      choices: [
        { name: 'Member', value: '1' },
        { name: 'VIP 🌟', value: '2' },
        { name: 'Admin 👑', value: '3' },
      ],
    })
  })

  it('filters choices by query', async () => {
    const resAutocompleteMock = vi.fn((val: unknown) => val)
    const context = {
      interaction: {
        guild_id: 'guild-123',
      },
      env: {
        DISCORD_TEST_GUILD_ID: 'guild-123',
      },
      focused: {
        value: 'vip',
      },
      resAutocomplete: resAutocompleteMock,
      rest: vi.fn(async () => ({
        ok: true,
        json: async () => sampleRoles,
      })),
    }

    await command_addRole.autocomplete(context as never)

    expect(resAutocompleteMock).toHaveBeenCalledWith({
      choices: [{ name: 'VIP 🌟', value: '2' }],
    })
  })
})

describe('command_addRole handler', () => {
  const createMockContext = ({
    isAdmin = true,
    guildId = 'guild-123',
    channelId = 'channel-456',
    role = 'role-1',
    message,
    user,
    react,
    interactionMessage,
    resolvedMessages,
    roles = [
      { id: 'role-1', name: 'VIP 🌟' },
      { id: 'role-no-emoji', name: 'Regular' },
    ],
    targetMessage = {
      id: 'target-msg-1',
      author: { id: 'target-user-1' },
    },
    channelMessages = [],
  }: {
    isAdmin?: boolean
    guildId?: string
    channelId?: string
    role?: string
    message?: string
    user?: string
    react?: boolean
    interactionMessage?: unknown
    resolvedMessages?: Record<string, unknown>
    roles?: { id: string; name: string }[]
    targetMessage?: { id: string; author?: { id: string } } | null
    channelMessages?: unknown[]
  }) => {
    const restCalls: {
      method: string
      path: string
      vars: unknown[]
      data?: unknown
    }[] = []
    const resMock = vi.fn((val: string) => val)

    const context = {
      interaction: {
        guild_id: guildId,
        channel_id: channelId,
        member: {
          permissions: isAdmin ? '8' : '0',
          roles: [],
        },
        message: interactionMessage,
        data: resolvedMessages
          ? { resolved: { messages: resolvedMessages } }
          : undefined,
      },
      env: {
        DISCORD_TEST_GUILD_ID: 'guild-123',
      },
      var: {
        role,
        message,
        user,
        react,
      },
      flags: vi.fn(() => ({
        res: resMock,
      })),
      rest: vi.fn(
        async (
          method: string,
          path: string,
          vars: unknown[],
          data?: unknown,
        ) => {
          restCalls.push({ method, path, vars, data })

          if (method === 'GET' && path === '/guilds/{guild.id}/roles') {
            return { ok: true, json: async () => roles }
          }
          if (
            method === 'GET' &&
            path === '/channels/{channel.id}/messages/{message.id}'
          ) {
            return targetMessage
              ? { ok: true, json: async () => targetMessage }
              : { ok: false, status: 404 }
          }
          if (method === 'GET' && path === '/channels/{channel.id}/messages') {
            const list =
              channelMessages.length > 0
                ? channelMessages
                : targetMessage
                  ? [targetMessage]
                  : []
            return { ok: true, json: async () => list }
          }
          if (
            method === 'PUT' &&
            path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}'
          ) {
            return { ok: true, json: async () => ({}) }
          }
          if (
            method === 'PUT' &&
            path ===
              '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me'
          ) {
            return { ok: true, json: async () => ({}) }
          }
          return { ok: true, json: async () => ({}) }
        },
      ),
    }

    return { context, restCalls, resMock }
  }

  it('rejects unauthorized users', async () => {
    const { context, resMock } = createMockContext({ isAdmin: false })

    await command_addRole.handler(context as never)

    expect(resMock).toHaveBeenCalledWith('Unauthorized.')
  })

  it('applies role and reacts with trailing emojis followed by medal', async () => {
    const { context, restCalls, resMock } = createMockContext({
      role: 'role-1',
    })

    await command_addRole.handler(context as never)

    const rolePutCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    )
    expect(rolePutCall).toBeDefined()
    expect(rolePutCall?.vars).toEqual(['guild-123', 'target-user-1', 'role-1'])

    const reactCalls = restCalls.filter(
      (c) =>
        c.method === 'PUT' &&
        c.path ===
          '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me',
    )
    expect(reactCalls).toHaveLength(2)
    expect(decodeURIComponent(reactCalls[0]?.vars[2] as string)).toBe('🌟')
    expect(decodeURIComponent(reactCalls[1]?.vars[2] as string)).toBe('🏅')

    expect(resMock).toHaveBeenCalledWith('Role applied and reactions added.')
  })

  it('reacts with medal even when role has no trailing emojis', async () => {
    const { context, restCalls, resMock } = createMockContext({
      role: 'role-no-emoji',
    })

    await command_addRole.handler(context as never)

    const rolePutCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    )
    expect(rolePutCall).toBeDefined()

    const reactCalls = restCalls.filter(
      (c) =>
        c.method === 'PUT' &&
        c.path ===
          '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me',
    )
    expect(reactCalls).toHaveLength(1)
    expect(decodeURIComponent(reactCalls[0]?.vars[2] as string)).toBe('🏅')

    expect(resMock).toHaveBeenCalledWith('Role applied and reactions added.')
  })

  it('applies role directly to explicit user without requiring message', async () => {
    const { context, restCalls, resMock } = createMockContext({
      user: 'explicit-user-456',
      targetMessage: null,
      channelMessages: [],
    })

    await command_addRole.handler(context as never)

    const rolePutCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    )
    expect(rolePutCall).toBeDefined()
    expect(rolePutCall?.vars).toEqual([
      'guild-123',
      'explicit-user-456',
      'role-1',
    ])

    const reactCalls = restCalls.filter(
      (c) =>
        c.method === 'PUT' &&
        c.path ===
          '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me',
    )
    expect(reactCalls).toHaveLength(0)

    expect(resMock).toHaveBeenCalledWith('Role applied.')
  })

  it('finds and reacts to latest image message by user when react is true', async () => {
    const imageMessage = {
      id: 'img-msg-99',
      author: { id: 'user-777' },
      attachments: [{ id: 'att-1', content_type: 'image/png' }],
    }
    const { context, restCalls, resMock } = createMockContext({
      user: 'user-777',
      targetMessage: null,
      channelMessages: [imageMessage],
      react: true,
    })

    await command_addRole.handler(context as never)

    const rolePutCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    )
    expect(rolePutCall?.vars[1]).toBe('user-777')

    const reactCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path ===
          '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me',
    )
    expect(reactCall?.vars[1]).toBe('img-msg-99')
    expect(resMock).toHaveBeenCalledWith('Role applied and reactions added.')
  })

  it('does not react when react is explicitly false', async () => {
    const { context, restCalls, resMock } = createMockContext({
      role: 'role-1',
      react: false,
    })

    await command_addRole.handler(context as never)

    const reactCalls = restCalls.filter(
      (c) =>
        c.method === 'PUT' &&
        c.path ===
          '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me',
    )
    expect(reactCalls).toHaveLength(0)
    expect(resMock).toHaveBeenCalledWith('Role applied.')
  })

  it('prefers explicit user option over message author when both are present', async () => {
    const { context, restCalls } = createMockContext({
      user: 'override-user-789',
      role: 'role-1',
    })

    await command_addRole.handler(context as never)

    const rolePutCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    )
    expect(rolePutCall?.vars[1]).toBe('override-user-789')
  })

  it('resolves message from interaction reply message', async () => {
    const { context, restCalls } = createMockContext({
      interactionMessage: {
        id: 'reply-msg-id',
        author: { id: 'reply-author-id' },
      },
    })

    await command_addRole.handler(context as never)

    const rolePutCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    )
    expect(rolePutCall?.vars[1]).toBe('reply-author-id')
  })
})

describe('contextMenu_addRole', () => {
  it('rejects unauthorized users', async () => {
    const resMock = vi.fn((val: string) => val)
    const context = {
      interaction: {
        member: { permissions: '0', roles: [] },
      },
      flags: vi.fn(() => ({ res: resMock })),
    }

    await contextMenu_addRole.handler(context as never)

    expect(resMock).toHaveBeenCalledWith('Unauthorized.')
  })

  it('returns modal with role select and checkbox for target message', async () => {
    const resModalMock = vi.fn((val: unknown) => val)
    const context = {
      interaction: {
        member: { permissions: '8', roles: [] },
        data: {
          target_id: 'target-123',
          resolved: {
            messages: {
              'target-123': {
                id: 'target-123',
                author: { id: 'author-456' },
              },
            },
          },
        },
      },
      resModal: resModalMock,
    }

    await contextMenu_addRole.handler(context as never)

    expect(resModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_id: 'modal_add_role;target-123;author-456',
        title: 'Add Role',
      }),
    )
  })
})

describe('modal_addRole', () => {
  const createMockModalContext = ({
    isAdmin = true,
    guildId = 'guild-123',
    channelId = 'channel-456',
    customValue = 'target-123;author-456',
    roleSelect = ['role-1'],
    reactChecked = true,
    roles = [{ id: 'role-1', name: 'Champion 🏆' }],
    targetMessage = {
      id: 'target-123',
      author: { id: 'author-456' },
    },
  }: {
    isAdmin?: boolean
    guildId?: string
    channelId?: string
    customValue?: string
    roleSelect?: string[] | string
    reactChecked?: boolean
    roles?: { id: string; name: string }[]
    targetMessage?: { id: string; author?: { id: string } } | null
  }) => {
    const restCalls: {
      method: string
      path: string
      vars: unknown[]
      data?: unknown
    }[] = []
    const resMock = vi.fn((val: string) => val)

    const context = {
      interaction: {
        guild_id: guildId,
        channel_id: channelId,
        member: {
          permissions: isAdmin ? '8' : '0',
          roles: [],
        },
        data: {
          custom_id: 'modal_add_role',
          components: [
            {
              type: 18,
              component: {
                custom_id: 'role_select_native',
                values: Array.isArray(roleSelect) ? roleSelect : [roleSelect],
              },
            },
            {
              type: 18,
              component: {
                custom_id: 'react_checkbox',
                value: reactChecked,
              },
            },
          ],
        },
      },
      ref: {
        custom_value: customValue,
      },
      var: {
        role_select_native: roleSelect,
        react_checkbox: reactChecked,
      },
      env: {
        DISCORD_TEST_GUILD_ID: 'guild-123',
      },
      flags: vi.fn(() => ({
        res: resMock,
      })),
      rest: vi.fn(
        async (
          method: string,
          path: string,
          vars: unknown[],
          data?: unknown,
        ) => {
          restCalls.push({ method, path, vars, data })

          if (method === 'GET' && path === '/guilds/{guild.id}/roles') {
            return { ok: true, json: async () => roles }
          }
          if (
            method === 'GET' &&
            path === '/channels/{channel.id}/messages/{message.id}'
          ) {
            return targetMessage
              ? { ok: true, json: async () => targetMessage }
              : { ok: false, status: 404 }
          }
          if (
            method === 'PUT' &&
            path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}'
          ) {
            return { ok: true, json: async () => ({}) }
          }
          if (
            method === 'PUT' &&
            path ===
              '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me'
          ) {
            return { ok: true, json: async () => ({}) }
          }
          return { ok: true, json: async () => ({}) }
        },
      ),
    }

    return { context, restCalls, resMock }
  }

  it('rejects unauthorized users on modal submit', async () => {
    const { context, resMock } = createMockModalContext({ isAdmin: false })

    await modal_addRole.handler(context as never)

    expect(resMock).toHaveBeenCalledWith('Unauthorized.')
  })

  it('applies role and reacts when modal is submitted with checkbox true', async () => {
    const { context, restCalls, resMock } = createMockModalContext({
      reactChecked: true,
    })

    await modal_addRole.handler(context as never)

    const rolePutCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    )
    expect(rolePutCall?.vars).toEqual(['guild-123', 'author-456', 'role-1'])

    const reactCalls = restCalls.filter(
      (c) =>
        c.method === 'PUT' &&
        c.path ===
          '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me',
    )
    expect(reactCalls).toHaveLength(2)
    expect(decodeURIComponent(reactCalls[0]?.vars[2] as string)).toBe('🏆')
    expect(decodeURIComponent(reactCalls[1]?.vars[2] as string)).toBe('🏅')

    expect(resMock).toHaveBeenCalledWith('Role applied and reactions added.')
  })

  it('applies role without reacting when checkbox is false', async () => {
    const { context, restCalls, resMock } = createMockModalContext({
      reactChecked: false,
    })

    await modal_addRole.handler(context as never)

    const rolePutCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    )
    expect(rolePutCall).toBeDefined()

    const reactCalls = restCalls.filter(
      (c) =>
        c.method === 'PUT' &&
        c.path ===
          '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me',
    )
    expect(reactCalls).toHaveLength(0)

    expect(resMock).toHaveBeenCalledWith('Role applied.')
  })
})
