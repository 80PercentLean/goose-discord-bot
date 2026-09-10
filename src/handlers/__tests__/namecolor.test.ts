import { COLOR_ROLES, command_namecolor } from '../namecolor'

describe('command_namecolor', () => {
  const createMockContext = ({
    color,
    guildId = 'guild-123',
    roles = [],
    userId = 'user-123',
    restOk = true,
  }: {
    color?: string
    guildId?: string
    roles?: string[]
    userId?: string
    restOk?: boolean
  }) => {
    const restCalls: { method: string; path: string; vars: unknown[] }[] = []
    const resMock = vi.fn((val: string) => val)

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
      },
      var: {
        color,
      },
      flags: vi.fn(() => ({
        res: resMock,
      })),
      rest: vi.fn(async (method: string, path: string, vars: unknown[]) => {
        restCalls.push({ method, path, vars })
        return { ok: restOk }
      }),
    }

    return { context, restCalls, resMock }
  }

  const createMockAutocompleteContext = ({
    roles = [],
    query = '',
  }: {
    roles?: string[]
    query?: string
  }) => {
    const resAutocompleteMock = vi.fn((val: unknown) => val)
    const context = {
      interaction: {
        member: {
          roles,
        },
      },
      focused: {
        value: query,
      },
      resAutocomplete: resAutocompleteMock,
    }
    return { context, resAutocompleteMock }
  }

  it('removes color role when color is none and member has a color role', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: 'none',
      roles: ['1547480496123027506'],
    })

    await command_namecolor.handler(context as never)

    expect(restCalls).toEqual([
      {
        method: 'DELETE',
        path: '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
        vars: ['guild-123', 'user-123', '1547480496123027506'],
      },
    ])
    expect(resMock).toHaveBeenCalledWith('Removed your name color role.')
  })

  it('notifies when color is none and member has no color role', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: 'none',
      roles: ['other-role'],
    })

    await command_namecolor.handler(context as never)

    expect(restCalls).toHaveLength(0)
    expect(resMock).toHaveBeenCalledWith(
      "You don't have a name color role set.",
    )
  })

  it('denies setting color role if member lacks required achievement role', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: '1547480496123027506',
      roles: ['unrelated-role'],
    })

    await command_namecolor.handler(context as never)

    expect(restCalls).toHaveLength(0)
    expect(resMock).toHaveBeenCalledWith(
      "You don't have the required achievement role for this name color.",
    )
  })

  it('sets color role if member has required achievement role', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: '1547480496123027506',
      roles: ['1537764340621647872'],
    })

    await command_namecolor.handler(context as never)

    expect(restCalls).toEqual([
      {
        method: 'PUT',
        path: '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
        vars: ['guild-123', 'user-123', '1547480496123027506'],
      },
    ])
    expect(resMock).toHaveBeenCalledWith('Set your name color to Shnundo Name.')
  })

  it('allows Lucky Shundo to set Lucky Name and Shundo Name', async () => {
    const luckyShundoRoleId = '1537766667432501259'

    const { context: luckyContext, resMock: luckyRes } = createMockContext({
      color: '1547480746908975165',
      roles: [luckyShundoRoleId],
    })
    await command_namecolor.handler(luckyContext as never)
    expect(luckyRes).toHaveBeenCalledWith('Set your name color to Shundo Name.')

    const { context: nameContext, resMock: nameRes } = createMockContext({
      color: '1547479162879610920',
      roles: [luckyShundoRoleId],
    })
    await command_namecolor.handler(nameContext as never)
    expect(nameRes).toHaveBeenCalledWith('Set your name color to Lucky Name.')
  })

  it('removes existing color role when switching to a new color role', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: '1547480041292828682',
      roles: ['1547480496123027506', '1537762918416777267'],
    })

    await command_namecolor.handler(context as never)

    expect(restCalls).toEqual([
      {
        method: 'DELETE',
        path: '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
        vars: ['guild-123', 'user-123', '1547480496123027506'],
      },
      {
        method: 'PUT',
        path: '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
        vars: ['guild-123', 'user-123', '1547480041292828682'],
      },
    ])
    expect(resMock).toHaveBeenCalledWith('Set your name color to Hundo Name.')
  })

  it('notifies when user already has the requested color role', async () => {
    const { context, restCalls, resMock } = createMockContext({
      color: '1547480041292828682',
      roles: ['1547480041292828682', '1537762918416777267'],
    })

    await command_namecolor.handler(context as never)

    expect(restCalls).toHaveLength(0)
    expect(resMock).toHaveBeenCalledWith(
      'Your name color is already set to Hundo Name.',
    )
  })

  it('supports each color role with any of its valid achievement roles', async () => {
    for (const [roleId, config] of Object.entries(COLOR_ROLES)) {
      for (const requiredRole of config.requires) {
        const { context, resMock } = createMockContext({
          color: roleId,
          roles: [requiredRole],
        })

        await command_namecolor.handler(context as never)

        expect(resMock).toHaveBeenCalledWith(
          `Set your name color to ${config.name}.`,
        )
      }
    }
  })

  it('handles REST API error when setting role', async () => {
    const { context, resMock } = createMockContext({
      color: '1547480496123027506',
      roles: ['1537764340621647872'],
      restOk: false,
    })

    await command_namecolor.handler(context as never)

    expect(resMock).toHaveBeenCalledWith('Failed to set name color role.')
  })

  it('autocompletes only unlocked roles plus None', () => {
    const luckyShundo = '1537766667432501259'
    const { context, resAutocompleteMock } = createMockAutocompleteContext({
      roles: [luckyShundo],
    })

    command_namecolor.autocomplete(context as never)

    expect(resAutocompleteMock).toHaveBeenCalledWith({
      choices: [
        { name: 'None', value: 'none' },
        { name: 'Shundo Name', value: '1547480746908975165' },
        { name: 'Hundo Name', value: '1547480041292828682' },
        { name: 'Shiny Name', value: '1547479551242928158' },
        { name: 'Lucky Name', value: '1547479162879610920' },
      ],
    })
  })

  it('autocompletes only None when member has no qualifying roles', () => {
    const { context, resAutocompleteMock } = createMockAutocompleteContext({
      roles: ['random-role'],
    })

    command_namecolor.autocomplete(context as never)

    expect(resAutocompleteMock).toHaveBeenCalledWith({
      choices: [{ name: 'None', value: 'none' }],
    })
  })

  it('filters autocomplete choices by query', () => {
    const luckyShundo = '1537766667432501259'
    const { context, resAutocompleteMock } = createMockAutocompleteContext({
      roles: [luckyShundo],
      query: 'lucky',
    })

    command_namecolor.autocomplete(context as never)

    expect(resAutocompleteMock).toHaveBeenCalledWith({
      choices: [{ name: 'Lucky Name', value: '1547479162879610920' }],
    })
  })
})
