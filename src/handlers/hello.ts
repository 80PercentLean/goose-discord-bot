import { Command, Option } from 'discord-hono'

import { factory } from '../init'
import { isAdmin, isTeamMember } from '../util'

/**
 * hello Discord bot command
 */
export const command_hello = factory.command(
  new Command('hello', 'Hello, World!').options(
    new Option('name', 'Your name'),
  ),
  (c) => {
    if (
      !isAdmin(c.interaction.member?.permissions) &&
      !isTeamMember(c.interaction.member?.roles)
    ) {
      return c.res('Goose Bot denies you.')
    }

    return c.res(`Hello, ${c.var.name ?? 'World'}!`)
  },
)
