import { Hono } from "hono"

const app = new Hono<{
  Bindings: CloudflareBindings & {
    APP_ID: string
    DISCORD_TOKEN: string
    PUBLIC_KEY: string
  }
}>()

app.get("/message", (c) => {
  return c.text("Hello Hono!")
})

export default app
