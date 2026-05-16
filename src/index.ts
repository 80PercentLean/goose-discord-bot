import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { api } from './api'
import * as handlers from './handlers'
import { factory } from './init'

const discordApp = factory.discord().loader(Object.values(handlers))

const app = new Hono()

app.use('/api/*', cors({ origin: '*' }))

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
