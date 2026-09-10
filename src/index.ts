import {
  $channels$_$messages,
  Button,
  Content,
  Layout,
  createRest,
} from 'discord-hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { DateTime } from 'luxon'

import { api } from './api'
import * as handlers from './handlers'
import { formatLineBreaks, getFileNameFromUrl } from './handlers/helper'
import { factory } from './init'
import {
  type BaseBindings,
  type MessageData,
  type ScheduledMessage,
} from './types'

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
    const now = DateTime.now().setZone('America/Los_Angeles')

    const rest = createRest(env.DISCORD_TOKEN)

    if (now.weekday === 7 && now.hour === 21 && now.minute === 0) {
      // Send next week's upcoming scheduled message report
      try {
        console.log("Showing next week's scheduled message report.")

        const weekStart = now.plus({ days: 1 }).startOf('day')

        const weekEnd = weekStart.plus({ days: 7 })

        // Retrieve the pending messages from the database
        const { results } = await env.DB.prepare(
          `
            SELECT id, created_by, title, channel_id, send_time
            FROM scheduled_messages
            WHERE status = 'pending'
              AND send_time >= ?
              AND send_time < ?
            ORDER BY send_time ASC
          `,
        )
          .bind(weekStart.toUnixInteger(), weekEnd.toUnixInteger())
          .all<{
            id: ScheduledMessage['id']
            created_by: ScheduledMessage['created_by']
            channel_id: ScheduledMessage['channel_id']
            title: ScheduledMessage['title']
            send_time: ScheduledMessage['send_time']
          }>()

        const timeFrame = `(${weekStart.toFormat('ccc M/d')} - ${weekEnd.minus({ days: 1 }).toFormat('ccc M/d')})`

        if (results.length === 0) {
          // No pending scheduled messages were found
          await rest(
            'POST',
            $channels$_$messages,
            [MSG_SCHEDULER_CH_ID],
            `## Upcoming Scheduled Messages ${timeFrame}\nNothing is scheduled for the next 7 days. Make sure that's right and that nothing actually needs to go out!`,
          )
          return
        }

        // Pending scheduled messages were found
        await rest('POST', $channels$_$messages, [MSG_SCHEDULER_CH_ID], {
          flags: 32768,
          components: [
            new Content(`## Upcoming Scheduled Messages ${timeFrame}`),

            ...results.map((msg) => {
              return new Layout('Container').components(
                new Content(
                  `**${msg.title}**\n` +
                    `- **Send Time:** ${DateTime.fromSeconds(msg.send_time, {
                      zone: 'America/Los_Angeles',
                    }).toFormat('ccc M/d h:mm a ZZZZ')}\n` +
                    `- **Channel:** <#${msg.channel_id}>\n` +
                    `- **Author:** <@${msg.created_by}>\n` +
                    `- **ID:** ${msg.id}`,
                ),

                new Layout('Action Row').components(
                  new Button(
                    'schedule-preview',
                    ['🔍', 'Preview'],
                    'Primary',
                  ).custom_value(String(msg.id)),
                ),
              )
            }),
          ],
        })
      } catch (err) {
        // An error occurred while sending next week's upcoming scheduled message report
        // so silently fail and continue on sending scheduled messages if there are any
        console.error(
          "An error occurred while sending next week's upcoming scheduled message report.",
        )
        console.error(err)
      }
    }

    const unixTimestamp = now.toUnixInteger()

    // Get all pending scheduled messages that are due
    const { results } = await env.DB.prepare(
      `
          SELECT id, channel_id, created_by, content, image_url, suppress_embeds, attempts
          FROM scheduled_messages
          WHERE status = 'pending'
            AND send_time <= ?
          ORDER BY send_time ASC
          LIMIT 25
        `,
    )
      .bind(unixTimestamp)
      .all<{
        id: ScheduledMessage['id']
        channel_id: ScheduledMessage['channel_id']
        content: ScheduledMessage['content']
        created_by: ScheduledMessage['created_by']
        image_url: ScheduledMessage['image_url']
        suppress_embeds: ScheduledMessage['suppress_embeds']
        attempts: ScheduledMessage['attempts']
      }>()

    if (results.length > 0) {
      console.log(`Encountered ${results.length} scheduled message(s).`)
      for (const [i, { id }] of results.entries()) {
        console.log(`${i + 1}. Message: ${id}`)
      }
    } else {
      console.log(`No scheduled messages encountered.`)
      return
    }

    // Send all pending scheduled messages that are due
    for (const {
      id,
      attempts,
      channel_id: channelId,
      content,
      created_by: createdBy,
      image_url: imageUrl,
      suppress_embeds: suppressEmbeds,
    } of results) {
      const newAttempts = attempts + 1

      console.log(`Sending message ${id}...`)

      let discordId

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
        const data: MessageData = {
          content: formatLineBreaks(content),
          nonce: `sched-${id}`,
          enforce_nonce: true,
        }
        if (suppressEmbeds) {
          data.flags = 4
        }

        const messageRes = await rest(
          'POST',
          $channels$_$messages,
          [channelId],
          data,
          img,
        )

        if (messageRes.ok) {
          ;({ id: discordId } = (await messageRes.json()) as {
            id: string
          })

          if (!discordId) {
            throw new Error('Encountered an invalid Discord message ID.')
          }

          // Send confirmation message to #msg-scheduler
          const messageUrl =
            `https://discord.com/channels/` +
            `${env.DISCORD_TEST_GUILD_ID}/${channelId}/${discordId}`
          await rest(
            'POST',
            $channels$_$messages,
            [MSG_SCHEDULER_CH_ID],
            `Message with Discord ID [${discordId}](${messageUrl}) written by <@${createdBy}> was sent in <#${channelId}>.`,
          )
        } else {
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

      console.log(
        `Message ${id} sent was sent as Discord message ${discordId}.`,
      )

      try {
        // Update the database
        await env.DB.prepare(
          `
              UPDATE scheduled_messages
              SET
                status = 'sent',
                attempts = attempts + 1,
                sent_at = unixepoch(),
                discord_id = ?,
                last_error = NULL
              WHERE id = ?
            `,
        )
          .bind(discordId, id)
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
        return
      }
    }
  },
}
