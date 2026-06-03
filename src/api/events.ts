import { $guilds$_$scheduledevents, createRest } from 'discord-hono'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const events = new Hono<{
  Bindings: CloudflareBindings & {
    DISCORD_API_RES: KVNamespace
    DISCORD_TOKEN: string
    DISCORD_TEST_GUILD_ID: string
  }
}>()

/**
 * List guild scheduled events endpoint.
 * For more info: https://docs.discord.com/developers/resources/guild-scheduled-event
 */
events.get('/', async (c) => {
  let data
  const filter = c.req.query('filter')

  // Attempt to read cache
  if (filter === 'wg') {
    data = await c.env.DISCORD_API_RES.get('wg', { type: 'json' })
  } else if (filter === 'cup-pogo') {
    data = await c.env.DISCORD_API_RES.get('cup-pogo', { type: 'json' })
  } else {
    data = await c.env.DISCORD_API_RES.get('all', { type: 'json' })
  }

  if (!data) {
    console.log(
      `Cache miss for ${filter || 'all'}. Fetching fresh data from Discord API...`,
    )

    const rest = createRest(c.env.DISCORD_TOKEN)

    const eventsRes = await rest('GET', $guilds$_$scheduledevents, [
      c.env.DISCORD_TEST_GUILD_ID,
    ])

    const dataAll = await eventsRes.json()

    if (!eventsRes.ok) {
      throw new HTTPException(502, {
        message: 'Encountered a Discord API error',
        cause: {
          status: eventsRes.status,
          statusText: eventsRes.statusText,
          data: dataAll,
        },
      })
    }

    if (!Array.isArray(dataAll)) {
      throw new HTTPException(502, {
        message: 'Unexpected Discord API response',
        cause: {
          status: eventsRes.status,
          statusText: eventsRes.statusText,
          data: dataAll,
        },
      })
    }

    dataAll.sort(
      (a, b) =>
        new Date(a.scheduled_start_time).getTime() -
        new Date(b.scheduled_start_time).getTime(),
    )

    const dataWg = []
    const dataCupPogo = []

    for (const d of dataAll) {
      if (d.entity_metadata?.location) {
        const location = d.entity_metadata?.location?.toLowerCase()

        if (
          location &&
          (location.includes('central park') ||
            location.includes('pavilion') ||
            location.includes('santa clara'))
        ) {
          // Location matches Central Park/Santa Clara
          dataWg.push(d)
        } else if (
          location &&
          (location.includes('cupertino') ||
            location.includes('de anza college') ||
            location.includes('hinson') ||
            location.includes('memorial park') ||
            location.includes('quinlan'))
        ) {
          // Location matches Memorial Park/De Anza College
          dataCupPogo.push(d)
        } else {
          // Location is unknown, so just store in both
          dataWg.push(d)
          dataCupPogo.push(d)
        }
      }
    }

    // Cache Discord API response for 5 minutes
    await c.env.DISCORD_API_RES.put('wg', JSON.stringify(dataWg), {
      expirationTtl: 300,
    })
    await c.env.DISCORD_API_RES.put('cup-pogo', JSON.stringify(dataCupPogo), {
      expirationTtl: 300,
    })
    await c.env.DISCORD_API_RES.put('all', JSON.stringify(dataAll), {
      expirationTtl: 300,
    })

    console.log(
      `Cached Discord API response at ${new Date().toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Los_Angeles',
      })}.`,
    )

    if (filter === 'wg') {
      data = dataWg
    } else if (filter === 'cup-pogo') {
      data = dataCupPogo
    } else {
      data = dataAll
    }
  } else {
    console.log(`Cache hit for ${filter || 'all'}!`)
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
