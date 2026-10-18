import { Command, type createRest } from 'discord-hono'

import { factory } from '../init'

type RestClient = ReturnType<typeof createRest>

const responsesNormal = [
  'honk',
  'HONK',
  'HOOONK',
  'honk honk',
  'HONK HONK HONK',
]

const responsesAngry = [
  '🪿 HISSSSS',
  '🪿 Aggressive honking intensifies.',
  '🪿 The goose lowers its head menacingly.',
  '🪿 *flaps wings aggressively*',
  '🔪 HONK',
]

const responsesRare = [
  '⚠️ The goose has breached containment.',
  '🪿 The goose steals your sandwich and leaves.',
  '💩 Canadian air support inbound.',
  '🫪 quack',
]

const chooseRandom = <T>(items: T[]): T => {
  return items[Math.floor(Math.random() * items.length)]
}

const generateBreachIntervals = (
  count = 10,
  totalMs = 120_000,
  minIntervalMs = 3_000,
): number[] => {
  const remainingMs = Math.max(0, totalMs - count * minIntervalMs)
  const weights = Array.from({ length: count }, () => Math.random() + 0.1)
  const totalWeight = weights.reduce((acc, w) => acc + w, 0)
  return weights.map((w) =>
    Math.round(minIntervalMs + (w / totalWeight) * remainingMs),
  )
}

const executeBreachHonks = async (rest: RestClient, channelId: string) => {
  const intervals = generateBreachIntervals()
  for (const interval of intervals) {
    await new Promise((resolve) => setTimeout(resolve, interval))
    await rest('POST', '/channels/{channel.id}/messages', [channelId], {
      content: chooseRandom(responsesNormal),
    })
  }
}

/**
 * honk Discord bot command for checking if the bot is responsive.
 */
export const command_honk = factory.command(
  new Command('honk', 'Check on Goose Bot.'),
  (c) => {
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
    const rareResponse = chooseRandom(responsesRare)

    if (rareResponse === '⚠️ The goose has breached containment.') {
      const channelId = c.interaction.channel_id ?? c.interaction.channel?.id
      if (channelId && c.executionCtx) {
        c.executionCtx.waitUntil(executeBreachHonks(c.rest, channelId))
      }
    }

    return c.res(rareResponse)
  },
)
