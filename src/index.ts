import {
  $guilds$_$scheduledevents,
  Button,
  Components,
  DiscordHono,
} from "discord-hono"

const app = new DiscordHono()
  .command("hello", (c) => c.res(`Hello, ${c.var.name ?? "World"}!`))
  .command("helppp", (c) =>
    c.res({
      components: new Components().row(
        new Button("https://discord-hono.luis.fun", ["📑", "Docs"], "Link"),
        new Button("delete", ["🗑️", "Delete"]),
      ),
    }),
  )
  .command("events", async (c) => {
    if (!c.interaction.guild_id) {
      throw new Error("guild id coult not be found")
    }

    const events = await c
      .rest("GET", $guilds$_$scheduledevents, [c.interaction.guild_id])
      .then((res) => res.json())
    console.log("events")
    console.log(events)
    // return c.res(`${c.interaction.id} ${c.interaction.guild_id}`)
    return c.res("events")
  })
  .component("delete", (c) => c.update().resDefer((c) => c.followup()))

export default app

// Example to check next
// https://github.com/luisfun/discord-hono-examples/tree/main/workerd-use-factory
