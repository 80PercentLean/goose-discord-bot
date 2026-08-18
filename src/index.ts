import { $channels$_$messages, createRest } from 'discord-hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { api } from './api'
import * as handlers from './handlers'
import { formatLineBreaks, getFileNameFromUrl } from './handlers/helper'
import { factory } from './init'
import { type BaseBindings, type ScheduledMessage } from './types'

const MSG_SCHEDULER_CH_ID = '1466938432176652372'

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
      for (const [i, { id }] of results.entries()) {
        console.log(`${i + 1}. Message: ${id}`)
      }
    } else {
      console.log(`No scheduled messages encountered.`)
      return
    }

    const rest = createRest(env.DISCORD_TOKEN)

    for (const {
      id,
      attempts,
      channel_id: channelId,
      content,
      image_url: imageUrl,
    } of results) {
      const newAttempts = attempts + 1

      console.log(`Sending message ${id}...`)

      try {
        let img
        if (imageUrl) {
          const imageRes = await fetch(imageUrl)
          if (!imageRes.ok) {
            throw new Error(
              `Failed to fetch image: ${imageRes.status} ${imageRes.statusText}`,
            )
          }

          const blob = await imageRes.blob()
          img = {
            blob,
            name: getFileNameFromUrl(imageUrl),
          }
        }

        // Send the scheduled message
        const messageRes = await rest(
          'POST',
          $channels$_$messages,
          [channelId],
          {
            content: formatLineBreaks(content),
          },
          img,
        )

        if (!messageRes.ok) {
          const body = await messageRes.text()
          throw new Error(body)
        }
      } catch (err) {
        const errMsg = `Encountered an error while sending message ${id} on attempt ${newAttempts}.`
        const errLog = err instanceof Error ? err.message : String(err)
        console.error(errMsg)
        console.error(errLog)

        // Send error message to #msg-scheduler
        await rest(
          'POST',
          $channels$_$messages,
          [MSG_SCHEDULER_CH_ID],
          errMsg + `\n\`\`\`${errLog}\n\`\`\``,
        )

        // Update attempts & last_error vals
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
        return
      }

      console.log(`Message ${id} sent.`)

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
        const errLog = err instanceof Error ? err.message : String(err)
        const errMsg = `Encountered an error updating message ${id} in the database after sending it.`
        console.error(errMsg)
        console.error(err)

        // Send error message to #msg-scheduler
        await rest(
          'POST',
          $channels$_$messages,
          [MSG_SCHEDULER_CH_ID],
          errMsg + `\n\`\`\`${errLog}\n\`\`\``,
        )

        // Update attempts & last_error vals
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
