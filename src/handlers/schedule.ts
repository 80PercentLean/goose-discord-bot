import { Command, Embed, Option } from 'discord-hono'

import { factory } from '../init'
import { isAdmin, isTeamMember } from '../util'

interface CommandScheduleRes {
  content: string
  embeds?: Embed[]
}

/**
 * schedule Discord bot command
 */
export const command_schedule = factory.command(
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
  async (c) => {
    console.log('Command received')
    console.log(c.var)

    if (
      !isAdmin(c.interaction.member?.permissions) &&
      !isTeamMember(c.interaction.member?.roles)
    ) {
      return c.res('Goose Bot denies you.')
    }

    let content = `${c.var.destination_channel} ${c.var.content} ${c.var.send_time}`
    if (c.var.image_attachment) {
      console.log('Image attachment received')
      content += ` ${c.var.image_attachment}`

      const attachment = c.ref.attachments?.[c.var.image_attachment]

      if (attachment?.url) {
        const blob = await fetch(attachment.url).then((res) => res.blob())

        return c.flags('EPHEMERAL').res(content, {
          blob,
          name: attachment.filename,
        })
      }
    }

    return c.flags('EPHEMERAL').res(content)
  },
)
