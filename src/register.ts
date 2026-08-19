import { Command, Option, SubCommand, register } from 'discord-hono'

const commands = [
  new Command('hello', 'Attempt to get Goose Bot to notice you.').options(
    new Option('name', 'Your name'),
  ),
  new Command('help', 'Learn about the bot commands.'),
  new Command('honk', 'Check on Goose Bot.'),
  new Command('schedule', 'Manage scheduled messages.').options(
    new SubCommand(
      'new',
      'Schedule a message to be sent in the future.',
    ).options(
      new Option(
        'destination_channel',
        'Channel to send the message in',
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
      new Option(
        'suppress_embeds',
        'Do not include embeds when true',
        'Boolean',
      ),
    ),
    new SubCommand('list', 'List pending scheduled messages.'),
    new SubCommand('update', 'Update a sent scheduled message.').options(
      new Option(
        'discord_id',
        "Discord message ID - not to be confused with Goose Bot's message ID!",
      ).required(),
      new Option(
        'content',
        'Message content - you can type "<br>" or "\\n" to insert a line break (2000 character limit)',
      ).required(),
      new Option('image_attachment', 'Optional image attachment', 'Attachment'),
      new Option('image_url', 'Optional image URL'),
      new Option(
        'suppress_embeds',
        'Do not include embeds when true',
        'Boolean',
      ),
      new Option('remove_image', 'Remove an existing image', 'Boolean'),
    ),
  ),
  new Command(
    'force_edit',
    'Force edit any existing Goose Bot message.',
  ).options(
    new Option(
      'channel_id',
      'ID of the channel where the message is in',
    ).required(),
    new Option(
      'discord_id',
      "Discord message ID - not to be confused with Goose Bot's message ID!",
    ).required(),
    new Option(
      'content',
      'Message content - you can type "<br>" or "\\n" to insert a line break (2000 character limit)',
    ).required(),
    new Option('image_attachment', 'Optional image attachment', 'Attachment'),
    new Option('image_url', 'Optional image URL'),
    new Option('suppress_embeds', 'Do not include embeds when true', 'Boolean'),
    new Option('remove_image', 'Remove an existing image', 'Boolean'),
  ),
  new Command(
    'puppet',
    'Control Goose Bot to say something instantly.',
  ).options(
    new Option(
      'destination_channel',
      'Channel to send the message in',
      'Channel',
    )
      .channel_types()
      .required(),
    new Option(
      'content',
      'Message content - you can type "<br>" or "\\n" to insert a line break (2000 character limit)',
    ).required(),
    new Option('image_attachment', 'Optional image attachment', 'Attachment'),
    new Option('image_url', 'Optional image URL'),
    new Option('suppress_embeds', 'Do not include embeds when true', 'Boolean'),
  ),
]

register(
  commands,
  process.env.DISCORD_APPLICATION_ID,
  process.env.DISCORD_TOKEN,
  process.env.DISCORD_TEST_GUILD_ID,
)
