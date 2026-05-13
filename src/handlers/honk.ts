import { Command } from "discord-hono"

import { factory } from "../init"

/**
 * honk Discord bot command for checking if the bot is responsive.
 */
export const command_honk = factory.command(
  new Command("honk", "Check on Goose Bot."),
  (c) => {
    const responsesNormal = [
      "honk",
      "HONK",
      "HOOONK",
      "honk honk",
      "HONK HONK HONK",
    ]

    const responsesAngry = [
      "🪿 HISSSSS",
      "🪿 Aggressive honking intensifies.",
      "🪿 The goose lowers its head menacingly.",
      "🪿 *flaps wings aggressively*",
      "🔪 HONK",
    ]

    const responsesRare = [
      "⚠️ The goose has breached containment.",
      "🪿 The goose steals your sandwich and leaves.",
      "💩 Canadian air support inbound.",
      "🫪 quack",
    ]

    const chooseRandom = <T>(items: T[]): T => {
      return items[Math.floor(Math.random() * items.length)]
    }

    const roll = Math.random()

    // 70%
    if (roll < 0.7) {
      return c.res(chooseRandom(responsesNormal))
    }

    // 20%
    if (roll < 0.9) {
      return c.res(chooseRandom(responsesAngry))
    }

    // 10%
    return c.res(chooseRandom(responsesRare))
  },
)
