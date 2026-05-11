import { verifyKey } from "discord-interactions"
import { createMiddleware } from "hono/factory"

export const verifyDiscordRequest = createMiddleware(async (c, next) => {
  const signature = c.req.header("x-signature-ed25519")
  const timestamp = c.req.header("x-signature-timestamp")
  const body = await c.req.text()

  if (signature && timestamp) {
    const isValid = await verifyKey(
      body,
      signature,
      timestamp,
      c.env.PUBLIC_KEY,
    )

    if (!isValid) {
      return c.text("Bad request signature", 401)
    }

    c.set("interaction", JSON.parse(body))
    await next()
  }

  return c.text("Bad request signature", 401)
})
