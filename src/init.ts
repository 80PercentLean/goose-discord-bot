import { createFactory } from 'discord-hono'

export const factory = createFactory<{ Bindings: Env }>()
