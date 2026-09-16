import { createRest } from 'discord-hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { DateTime } from 'luxon'

import { api } from './api'
import * as handlers from './handlers'
import { factory } from './init'
import { processScheduledMessages, sendWeeklySummary } from './scheduled'
import { type HonoBindings } from './types'

const discordApp = factory.discord().loader(Object.values(handlers))

const app = new Hono<{
  Bindings: HonoBindings
}>()

app.use('/api/*', async (c, next) => {
  let options

  if (c.env.CORS_ORIGIN) {
    const origin = c.env.CORS_ORIGIN.split(',')
    options = { origin }
  }

  const customCorsMiddleware = cors(options)
  return customCorsMiddleware(c, next)
})

app.route('/api', api)

app.mount('/interactions', discordApp.fetch)

export default {
  fetch: app.fetch,

  async scheduled(
    controller: ScheduledController,
    env: HonoBindings,
    _ctx: ExecutionContext,
  ) {
    const now = DateTime.now().setZone('America/Los_Angeles')
    const rest = createRest(env.DISCORD_TOKEN)

    sendWeeklySummary(env, rest, now)
    processScheduledMessages(env, rest, now)
  },
}
