import { createFactory } from 'discord-hono'

export const factory = createFactory<{
  Bindings: CloudflareBindings & {
    DB: D1Database
  }
}>()
