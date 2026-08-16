import { $channels$_$messages, createRest } from 'discord-hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { api } from './api'
import * as handlers from './handlers'
import { formatLineBreaks } from './handlers/helper'
import { factory } from './init'
import { type BaseBindings, type ScheduledMessage } from './types'

const discordApp = factory.discord().loader(Object.values(handlers))

type Bindings = BaseBindings & {
  CORS_ORIGIN: string
  DISCORD_TOKEN: string
  DISCORD_TEST_GUILD_ID: string
}

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
    _ctx: ExecutionContext,
  ) {
    const now = Math.floor(Date.now() / 1000)

    const { results } = await env.DB.prepare(
      `
          SELECT *
          FROM scheduled_messages
          WHERE status = 'pending'
            AND send_time <= ?
          ORDER BY send_time ASC
          LIMIT 25
        `,
    )
      .bind(now)
      .all<ScheduledMessage>()

    if (results.length > 0) {
      console.log(`Encountered ${results.length} scheduled message(s).`)
      for (const { id } of results) {
        console.log(`Message: ${id}`)
      }
    } else {
      console.log('No scheduled messages encountered.')
      return
    }

    const rest = createRest(env.DISCORD_TOKEN)

    for (const { id, attempts, channel_id: channelId, content } of results) {
      const newAttempts = attempts + 1

      console.log(`Sending message ${id}.`)

      try {
        // Send the scheduled message
        await rest('POST', $channels$_$messages, [channelId], {
          content: formatLineBreaks(content),
        })
      } catch (err) {
        console.error('Encountered an error while sending the message.')
        console.error(err)

        // Encountered error with sending the message, so update attempts & last_error vals
        const errMsg = err instanceof Error ? err.message : String(err)

        await env.DB.prepare(
          `
              UPDATE scheduled_messages
              SET
                attempts = ?,
                status = ?,
                last_error = ?
              WHERE id = ?
            `,
        )
          .bind(
            newAttempts,
            newAttempts >= 3 ? 'failed' : 'pending',
            errMsg,
            id,
          )
          .run()
      }

      try {
        // Update the database
        await env.DB.prepare(
          `
              UPDATE scheduled_messages
              SET
                status = 'sent',
                attempts = attempts + 1,
                sent_at = unixepoch(),
                last_error = NULL
              WHERE id = ?
            `,
        )
          .bind(id)
          .run()
      } catch (err) {
        console.error('Encountered an error while updating the database.')
        console.error(err)

        // Encountered error with updating the database, so update attempts & last_error vals
        const errMsg = err instanceof Error ? err.message : String(err)

        await env.DB.prepare(
          `
              UPDATE scheduled_messages
              SET
                attempts = ?,
                status = ?,
                last_error = ?
              WHERE id = ?
            `,
        )
          .bind(
            newAttempts,
            newAttempts >= 3 ? 'failed' : 'pending',
            errMsg,
            id,
          )
          .run()
      }
    }
  },
}
