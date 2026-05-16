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
 * List guild scheduled events endpoint.
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

  let data
  const filter = c.req.query('filter')
  if (filter === 'wg') {
    data = eventsJson.filter(({ entity_metadata }) => {
      if (
        entity_metadata?.location &&
        (entity_metadata.location.includes('Central Park') ||
          entity_metadata.location.includes('Pavilion') ||
          entity_metadata.location.includes('Santa Clara'))
      ) {
        return true
      }
      return false
    })
  } else if (filter === 'cup-pogo') {
    data = eventsJson.filter(({ entity_metadata }) => {
      if (
        entity_metadata?.location &&
        (entity_metadata.location.includes('Cupertino') ||
          entity_metadata.location.includes('De Anza College') ||
          entity_metadata.location.includes('Hinson') ||
          entity_metadata.location.includes('Memorial Park') ||
          entity_metadata.location.includes('Quinlan'))
      ) {
        return true
      }
      return false
    })
  } else {
    data = eventsJson
  }

  // TODO: remove unnecessary data from events

  return c.json({
    data,
    meta: {
      apiVersion: 'v1',
      success: true,
    },
  })
})
