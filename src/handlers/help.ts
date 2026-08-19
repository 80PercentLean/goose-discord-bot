import { Button, Command, Components } from 'discord-hono'

import { factory } from '../init'
import { component_delete } from './utils'

/**
 * help Discord bot command
 */
export const command_help = factory.command(
  new Command('help', 'Learn about the bot commands.'),
  (c) =>
    c.res({
      components: new Components().row(
        new Button(
          'https://github.com/80PercentLean/goose-discord-bot/blob/main/docs/bot-commands.md',
          ['📑', 'Bot Command GitHub Documentation'],
          'Link',
        ),
        component_delete.component,
      ),
    }),
)
