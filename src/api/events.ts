import { $guilds$_$scheduledevents, createRest } from "discord-hono"
import { Hono } from "hono"

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
events.get("/", async (c) => {
  const rest = createRest(c.env.DISCORD_TOKEN)

  const events = await rest("GET", $guilds$_$scheduledevents, [
    c.env.DISCORD_TEST_GUILD_ID,
  ]).then((res) => res.json())

  // TODO: remove unnecessary data from events

  return c.json({
    data: events,
    meta: {
      apiVersion: "v1",
      success: true,
    },
  })
})
