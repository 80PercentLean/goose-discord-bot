import { $channels$_$messages, createRest } from 'discord-hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { api } from './api'
import * as handlers from './handlers'
import { factory } from './init'

type Bindings = CloudflareBindings & {
  CORS_ORIGIN: string
  DISCORD_TOKEN: string
  DISCORD_TEST_GUILD_ID: string
}

const discordApp = factory.discord().loader(Object.values(handlers))

const app = new Hono<{
  Bindings: Bindings
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
    env: Bindings,
    ctx: ExecutionContext,
  ) {
    console.log('cron processed!?!', '1456991439811772447')

    // const rest = createRest(env.DISCORD_TOKEN)

    // const msgRes = await rest(
    //   'POST',
    //   $channels$_$messages,
    //   ['1456991439811772447'],
    //   { content: 'hello' },
    // )
    // console.log(JSON.stringify(msgRes))
  },
}
