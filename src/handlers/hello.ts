import { Command, Option } from 'discord-hono'

import { factory } from '../init'
import { validateUserPermissions } from './helper'

/**
 * hello Discord bot command
 */
export const command_hello = factory.command(
  new Command('hello', 'Hello, World!').options(
    new Option('name', 'Your name'),
  ),
  (c) => {
    if (!validateUserPermissions(c.interaction)) {
      return c.res('🚫 Goose Bot denies you.')
    }

    return c.res(`Hello, ${c.var.name ?? 'World'}!`)
  },
)
