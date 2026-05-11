import { Command, Option } from 'discord-hono'
import { factory } from '../init.js'

export const command_hello = factory.command(
  new Command('hello', 'Hello, World!').options(new Option('name', 'Your name')),
  c => c.res(`Hello, ${c.var.name ?? 'World'}!`),
)
