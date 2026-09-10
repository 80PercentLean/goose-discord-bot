import { Command, Option } from 'discord-hono'

import { factory } from '../init'

const SHNUNDO = ['1537764340621647872']
const LUCKY_SHUNDO = ['1537770325863825509', '1537766667432501259']
const SHUNDO = [
  '1547168397534437386',
  '1537784576171188234',
  '1537778900971823104',
  '1537764114791661678',
]
const HUNDO = [
  '1537769003395711056',
  '1537776493260841000',
  '1537927355295596585',
  '1537925368986603623',
  '1537762918416777267',
]
const NUNDO = ['1537763840358621234']
const SHINY = [
  '1537767436743606292',
  '1537929195009867806',
  '1537924417810858135',
  '1537761312396939274',
]
const LUCKY = ['1537777594194460754']

export const COLOR_ROLES = {
  '1547480496123027506': {
    name: 'Shnundo Name',
    requires: [...SHNUNDO],
  },
  '1547480746908975165': {
    name: 'Shundo Name',
    requires: [...LUCKY_SHUNDO, ...SHUNDO],
  },
  '1547480041292828682': {
    name: 'Hundo Name',
    requires: [...LUCKY_SHUNDO, ...SHUNDO, ...HUNDO],
  },
  '1547480233417121842': {
    name: 'Nundo Name',
    requires: [...SHNUNDO, ...NUNDO],
  },
  '1547479551242928158': {
    name: 'Shiny Name',
    requires: [...LUCKY_SHUNDO, ...SHUNDO, ...SHNUNDO, ...SHINY],
  },
  '1547479162879610920': {
    name: 'Lucky Name',
    requires: [...LUCKY_SHUNDO, ...LUCKY],
  },
} as const

export const command_namecolor = factory.autocomplete(
  new Command('namecolor', 'Set or remove your name color role.').options(
    new Option('color', 'Name color role').autocomplete().required(),
  ),
  (c) => {
    const userRoles = c.interaction.member?.roles ?? []
    const query = (c.focused?.value as string)?.toLowerCase() ?? ''
    const choices = [
      { name: 'None', value: 'none' },
      ...Object.entries(COLOR_ROLES)
        .filter(([_, { requires }]) =>
          requires.some((id) => userRoles.includes(id)),
        )
        .map(([value, { name }]) => ({ name, value })),
    ].filter(({ name }) => name.toLowerCase().includes(query))

    return c.resAutocomplete({ choices })
  },
  async (c) => {
    const guildId = c.interaction.guild_id ?? c.env.DISCORD_TEST_GUILD_ID
    const userId = c.interaction.member?.user?.id
    const userRoles = c.interaction.member?.roles ?? []

    if (!guildId || !userId) {
      return c.flags('EPHEMERAL').res('Failed to identify user or server.')
    }

    const selected = c.var.color as keyof typeof COLOR_ROLES | 'none'
    const rolesToRemove = Object.keys(COLOR_ROLES).filter(
      (id) => userRoles.includes(id) && id !== selected,
    )

    if (selected === 'none') {
      if (rolesToRemove.length === 0) {
        return c.flags('EPHEMERAL').res("You don't have a name color role set.")
      }
      await Promise.all(
        rolesToRemove.map((id) =>
          c.rest(
            'DELETE',
            '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
            [guildId, userId, id],
          ),
        ),
      )
      return c.flags('EPHEMERAL').res('Removed your name color role.')
    }

    const target = COLOR_ROLES[selected]
    if (!target) {
      return c.flags('EPHEMERAL').res('Invalid name color role.')
    }

    if (!target.requires.some((id) => userRoles.includes(id))) {
      return c
        .flags('EPHEMERAL')
        .res(
          "You don't have the required achievement role for this name color.",
        )
    }

    if (userRoles.includes(selected)) {
      return c
        .flags('EPHEMERAL')
        .res(`Your name color is already set to ${target.name}.`)
    }

    await Promise.all(
      rolesToRemove.map((id) =>
        c.rest(
          'DELETE',
          '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
          [guildId, userId, id],
        ),
      ),
    )

    const res = await c.rest(
      'PUT',
      '/guilds/{guild.id}/members/{user.id}/roles/{role.id}',
      [guildId, userId, selected],
    )

    if (!res.ok) {
      return c.flags('EPHEMERAL').res('Failed to set name color role.')
    }

    return c.flags('EPHEMERAL').res(`Set your name color to ${target.name}.`)
  },
)
