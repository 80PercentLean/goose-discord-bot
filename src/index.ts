import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
} from "discord-interactions"
import { Hono } from "hono"

import { verifyDiscordRequest } from "./middleware"
import { getRandomEmoji } from "./utils"

const app = new Hono<{
  Bindings: CloudflareBindings & {
    APP_ID: string
    DISCORD_TOKEN: string
    PUBLIC_KEY: string
  }
}>()

app.post("/interactions", verifyDiscordRequest, async (c) => {
  const { id, type, data } = await c.req.json<{
    id: string
    type: InteractionType
    data: any
  }>()

  if (type === InteractionType.PING) {
    return c.json({ type: InteractionResponseType.PONG })
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data

    if (name === "test") {
      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `hello world ${getRandomEmoji()}`,
            },
          ],
        },
      })
    }

    return c.json({ error: "unknown command" }, 400)
  }

  return c.json({ error: "unknown interaction type" }, 400)
})

export default app
