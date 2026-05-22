import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { api } from './api'
import * as handlers from './handlers'
import { factory } from './init'

const discordApp = factory.discord().loader(Object.values(handlers))

const app = new Hono<{
  Bindings: CloudflareBindings & { CORS_ORIGIN: string }
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
    env: CloudflareBindings,
    ctx: ExecutionContext,
  ) {
    console.log('cron processed')
  },
}
