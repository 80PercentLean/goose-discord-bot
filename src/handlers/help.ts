import { Button, Command, Components } from 'discord-hono'
import { factory } from '../init.js'
import { component_delete } from './utils.js'

export const command_help = factory.command(new Command('help', 'response help'), c =>
  c.res({
    components: new Components().row(
      new Button('https://discord-hono.luis.fun', ['📑', 'Docs'], 'Link'),
      component_delete.component,
    ),
  }),
)
