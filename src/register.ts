import { Command, Option, register } from 'discord-hono'

const commands = [
  new Command('hello', 'Hello, World!').options(
    new Option('name', 'Your name'),
  ),
  new Command('help', 'Docs URL'),
  new Command('honk', 'Check on Goose Bot.'),
  new Command(
    'schedule',
    'Schedule a message to be sent in the future.',
  ).options(
    new Option(
      'destination_channel',
      'Channel or thread to send the message in',
      'Channel',
    )
      .channel_types()
      .required(),
    new Option('content', 'Message content').required(),
    new Option(
      'send_time',
      'When to send the message in Pacific Time',
    ).required(),
    new Option('image_attachment', 'Optional image attachment', 'Attachment'),
  ),
]

register(
  commands,
  process.env.DISCORD_APPLICATION_ID,
  process.env.DISCORD_TOKEN,
  process.env.DISCORD_TEST_GUILD_ID,
)
