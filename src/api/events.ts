import { $guilds$_$scheduledevents, createRest } from 'discord-hono'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const events = new Hono<{
  Bindings: CloudflareBindings & {
    DISCORD_TOKEN: string
    DISCORD_TEST_GUILD_ID: string
  }
}>()

/**
 * List guild scheduled event endpoint.
 * For more info: https://docs.discord.com/developers/resources/guild-scheduled-event
 */
events.get('/', async (c) => {
  const rest = createRest(c.env.DISCORD_TOKEN)

  const eventsRes = await rest('GET', $guilds$_$scheduledevents, [
    c.env.DISCORD_TEST_GUILD_ID,
  ])

  const eventsJson = await eventsRes.json()
  if (!eventsRes.ok) {
    throw new HTTPException(502, {
      message: 'Encountered a Discord API error',
      cause: {
        status: eventsRes.status,
        statusText: eventsRes.statusText,
        data: eventsJson,
      },
    })
  }

  // TODO: remove unnecessary data from events

  return c.json({
    data: eventsJson,
    meta: {
      apiVersion: 'v1',
      success: true,
    },
  })
})
