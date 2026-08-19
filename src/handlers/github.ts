import { Button, Command, Components } from 'discord-hono'

import { factory } from '../init'
import { component_delete } from './utils'

/**
 * github Discord bot command
 */
export const command_github = factory.command(
  new Command('github', 'Get a link to the GitHub repository.'),
  (c) =>
    c.res({
      components: new Components().row(
        new Button(
          'https://github.com/80PercentLean/goose-discord-bot/',
          ['💻', 'This bot is open source on GitHub!'],
          'Link',
        ),
        component_delete.component,
      ),
    }),
)
