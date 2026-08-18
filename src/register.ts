import { Command, Option, SubCommand, register } from 'discord-hono'

const commands = [
  new Command('hello', 'Hello, World!').options(
    new Option('name', 'Your name'),
  ),
  new Command('help', 'Docs URL'),
  new Command('honk', 'Check on Goose Bot.'),
  new Command('schedule', 'Manage scheduled messages.').options(
    new SubCommand(
      'new',
      'Schedule a message to be sent in the future.',
    ).options(
      new Option(
        'destination_channel',
        'Channel or thread to send the message in',
        'Channel',
      )
        .channel_types()
        .required(),
      new Option(
        'title',
        "Scheduler title. It's only used for identifying the message in the list command.",
      ).required(),
      new Option(
        'content',
        'Message content - you can type "<br>" or "\\n" to insert a line break (2000 character limit)',
      ).required(),
      new Option(
        'send_time',
        'When to send the message in Pacific Time (example: 8/13 7:00pm)',
      ).required(),
      new Option('image_attachment', 'Optional image attachment', 'Attachment'),
      new Option('image_url', 'Optional image URL'),
    ),
    new SubCommand('list', 'List pending scheduled messages.'),
  ),
]

register(
  commands,
  process.env.DISCORD_APPLICATION_ID,
  process.env.DISCORD_TOKEN,
  process.env.DISCORD_TEST_GUILD_ID,
)
