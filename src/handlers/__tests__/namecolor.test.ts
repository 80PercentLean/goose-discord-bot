import { describe, expect, it, vi } from 'vitest'

import {
  type DiscordRole,
  command_namecolor,
  getRoleColorName,
  getRoleColors,
} from '../namecolor'

describe('namecolor utilities', () => {
  it('extracts single color', () => {
    const role: DiscordRole = {
      id: '1',
      name: 'Red',
      color: 0xff0000,
      position: 1,
    }
    expect(getRoleColors(role)).toEqual([0xff0000])
    expect(getRoleColorName(role)).toBe('[Color] #FF0000')
  })

  it('extracts two-stop gradient', () => {
    const role: DiscordRole = {
      id: '2',
      name: 'Bicolor',
      color: 0xff0000,
      position: 2,
      colors: {
        primary_color: 0xff0000,
        secondary_color: 0x00ff00,
      },
    }
    expect(getRoleColors(role)).toEqual([0xff0000, 0x00ff00])
    expect(getRoleColorName(role)).toBe('[Color] #FF0000 - #00FF00')
  })

  it('extracts three-stop gradient', () => {
    const role: DiscordRole = {
      id: '3',
      name: 'Tricolor',
      color: 0xa9caff,
      position: 3,
      colors: {
        primary_color: 11127295,
        secondary_color: 16759788,
        tertiary_color: 16761760,
      },
    }
    expect(getRoleColors(role)).toEqual([11127295, 16759788, 16761760])
    expect(getRoleColorName(role)).toBe('[Color] #A9C9FF - #FFBBEC - #FFC3A0')
  })

  it('returns empty for colorless roles', () => {
    const role: DiscordRole = {
      id: '4',
      name: 'Default',
      color: 0,
      position: 0,
    }
    expect(getRoleColors(role)).toEqual([])
  })
})

describe('command_namecolor', () => {
  const sampleRoles: DiscordRole[] = [
    { id: 'bot-role', name: 'Bot', color: 0, position: 50 },
    { id: 'hundo', name: 'Hundo', color: 0xff0000, position: 20 },
    { id: 'shundo', name: 'Shundo', color: 0xffff00, position: 25 },
    {
      id: 'shundo-bg',
      name: 'Shundo BG',
      color: 0xffff00,
      position: 26,
    },
    { id: 'colorless', name: 'Member', color: 0, position: 5 },
    {
      id: 'existing-color',
      name: '[Color] #FF0000',
      color: 0xff0000,
      position: 45,
    },
  ]

  const createMockContext = ({
    color,
    guildId = 'guild-123',
    roles = [],
    userId = 'user-123',
    allRoles = sampleRoles,
    members = [],
    botRoles = ['bot-role'],
  }: {
    color?: string
    guildId?: string
    roles?: string[]
    userId?: string
    allRoles?: DiscordRole[]
    members?: { user?: { id: string }; roles: string[] }[]
    botRoles?: string[]
  }) => {
    const restCalls: {
      method: string
      path: string
      vars: unknown[]
      data?: unknown
    }[] = []
    const resMock = vi.fn((val: string) => val)

    const dynamicRoles = [...allRoles]

    const context = {
      interaction: {
        guild_id: guildId,
        member: {
          user: { id: userId },
          roles,
        },
      },
      env: {
        DISCORD_TEST_GUILD_ID: 'fallback-guild',
        DISCORD_APPLICATION_ID: 'bot-id',
      },
      var: {
        color,
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
            return { ok: true, json: async () => dynamicRoles }
          }
          if (
            method === 'GET' &&
            path === '/guilds/{guild.id}/members/{user.id}'
          ) {
            return { ok: true, json: async () => ({ roles: botRoles }) }
          }
          if (method === 'GET' && path === '/guilds/{guild.id}/members') {
            return { ok: true, json: async () => members }
          }
          if (method === 'POST' && path === '/guilds/{guild.id}/roles') {
            const payload = data as Record<string, unknown>
            const newRole: DiscordRole = {
              id: `created-${Date.now()}`,
              name:
                typeof payload?.name === 'string' ? payload.name : 'New Role',
              color: typeof payload?.color === 'number' ? payload.color : 0,
              position: 1,
              colors: payload?.colors as DiscordRole['colors'],
            }
            dynamicRoles.push(newRole)
            return { ok: true, json: async () => newRole }
          }
          return { ok: true, json: async () => ({}) }
        },
      ),
    }

    return { context, restCalls, resMock, dynamicRoles }
  }

  const createMockAutocompleteContext = ({
    roles = [],
    query = '',
    allRoles = sampleRoles,
  }: {
    roles?: string[]
    query?: string
    allRoles?: DiscordRole[]
  }) => {
    const resAutocompleteMock = vi.fn((val: unknown) => val)
    const context = {
      interaction: {
        guild_id: 'guild-123',
        member: {
          roles,
        },
      },
      env: {
        DISCORD_TEST_GUILD_ID: 'guild-123',
      },
      focused: {
        value: query,
      },
      resAutocomplete: resAutocompleteMock,
      rest: vi.fn(async () => ({
        ok: true,
        json: async () => allRoles,
      })),
    }
    return { context, resAutocompleteMock }
  }

  it('autocompletes only colored non-color-prefix roles the user holds', async () => {
    const { context, resAutocompleteMock } = createMockAutocompleteContext({
      roles: ['hundo', 'colorless', 'existing-color'],
    })

    await command_namecolor.autocomplete(context as never)

    expect(resAutocompleteMock).toHaveBeenCalledWith({
      choices: [
        { name: 'None', value: 'none' },
        { name: 'Hundo', value: 'hundo' },
      ],
    })
  })

  it('filters autocomplete choices by query', async () => {
    const { context, resAutocompleteMock } = createMockAutocompleteContext({
      roles: ['hundo', 'shundo'],
      query: 'shun',
    })

    await command_namecolor.autocomplete(context as never)

    expect(resAutocompleteMock).toHaveBeenCalledWith({
      choices: [{ name: 'Shundo', value: 'shundo' }],
    })
  })

  it('creates, positions, and assigns a new name color role', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: 'shundo',
      roles: ['shundo'],
    })

    await command_namecolor.handler(context as never)

    const postCall = restCalls.find(
      (c) => c.method === 'POST' && c.path === '/guilds/{guild.id}/roles',
    )
    expect(postCall).toBeDefined()
    expect((postCall?.data as Record<string, unknown>)?.name).toBe(
      '[Color] #FFFF00',
    )

    const patchCall = restCalls.find(
      (c) => c.method === 'PATCH' && c.path === '/guilds/{guild.id}/roles',
    )
    expect(patchCall).toBeDefined()
    expect((patchCall?.data as { position?: number }[])?.[0]?.position).toBe(49)

    const putCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    )
    expect(putCall).toBeDefined()
    expect(resMock).toHaveBeenCalledWith('Set your name color to Shundo.')
  })

  it('reuses existing role with the same color', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: 'hundo',
      roles: ['hundo'],
    })

    await command_namecolor.handler(context as never)

    const postCall = restCalls.find(
      (c) => c.method === 'POST' && c.path === '/guilds/{guild.id}/roles',
    )
    expect(postCall).toBeUndefined()

    const putCall = restCalls.find(
      (c) =>
        c.method === 'PUT' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
    )
    expect(putCall?.vars[2]).toBe('existing-color')
    expect(resMock).toHaveBeenCalledWith('Set your name color to Hundo.')
  })

  it('removes previous color role when switching and deletes if unused', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: 'shundo',
      roles: ['shundo', 'existing-color'],
      members: [{ user: { id: 'user-123' }, roles: ['existing-color'] }],
    })

    await command_namecolor.handler(context as never)

    const deleteFromUser = restCalls.find(
      (c) =>
        c.method === 'DELETE' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}' &&
        c.vars[2] === 'existing-color',
    )
    expect(deleteFromUser).toBeDefined()

    const deleteFromGuild = restCalls.find(
      (c) =>
        c.method === 'DELETE' &&
        c.path === '/guilds/{guild.id}/roles/{role.id}' &&
        c.vars[1] === 'existing-color',
    )
    expect(deleteFromGuild).toBeDefined()

    expect(resMock).toHaveBeenCalledWith('Set your name color to Shundo.')
  })

  it('does not delete previous color role if another member still has it', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: 'shundo',
      roles: ['shundo', 'existing-color'],
      members: [{ user: { id: 'other-user' }, roles: ['existing-color'] }],
    })

    await command_namecolor.handler(context as never)

    const deleteFromGuild = restCalls.find(
      (c) =>
        c.method === 'DELETE' &&
        c.path === '/guilds/{guild.id}/roles/{role.id}' &&
        c.vars[1] === 'existing-color',
    )
    expect(deleteFromGuild).toBeUndefined()
    expect(resMock).toHaveBeenCalledWith('Set your name color to Shundo.')
  })

  it('removes color role when none is selected and deletes if unused', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: 'none',
      roles: ['existing-color'],
      members: [],
    })

    await command_namecolor.handler(context as never)

    const deleteFromUser = restCalls.find(
      (c) =>
        c.method === 'DELETE' &&
        c.path === '/guilds/{guild.id}/members/{user.id}/roles/{role.id}' &&
        c.vars[2] === 'existing-color',
    )
    expect(deleteFromUser).toBeDefined()

    const deleteFromGuild = restCalls.find(
      (c) =>
        c.method === 'DELETE' &&
        c.path === '/guilds/{guild.id}/roles/{role.id}',
    )
    expect(deleteFromGuild).toBeDefined()
    expect(resMock).toHaveBeenCalledWith('Removed your name color role.')
  })

  it('notifies when none is selected but user has no color role', async () => {
    const { context, resMock } = createMockContext({
      color: 'none',
      roles: ['hundo'],
    })

    await command_namecolor.handler(context as never)

    expect(resMock).toHaveBeenCalledWith(
      "You don't have a name color role set.",
    )
  })

  it('notifies when user already has the requested color role', async () => {
    const { context, resMock } = createMockContext({
      color: 'hundo',
      roles: ['hundo', 'existing-color'],
    })

    await command_namecolor.handler(context as never)

    expect(resMock).toHaveBeenCalledWith(
      'Your name color is already set to this color.',
    )
  })
})
