import { Command, Option } from 'discord-hono'

import { factory } from '../init'
import { isAdmin, isTeamMember } from '../util'
import { formatLineBreaks, parseSendTime } from './helper'

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
    new Option(
      'content',
      'Message content - you can type "<br>" or "\\n" to insert a line break',
    ).required(),
    new Option(
      'send_time',
      'When to send the message in Pacific Time (example: 8/13 7:00pm)',
    ).required(),
    new Option('image_attachment', 'Optional image attachment', 'Attachment'),
  ),
  async (c) => {
    const userId = c.interaction?.member?.user?.id

    console.log(`Schedule command received from: ${userId}`)
    console.log(c.var)

    if (
      !isAdmin(c.interaction.member?.permissions) &&
      !isTeamMember(c.interaction.member?.roles)
    ) {
      return c.res('Goose Bot denies you.')
    }

    const db = c.env.DB

    const {
      destination_channel: destinationChannel,
      content,
      send_time: sendTime,
      image_attachment: imageAttachment,
    } = c.var

    // Validate the send time input
    const sendDateTime = parseSendTime(sendTime)

    if (!sendDateTime) {
      return c
        .flags('EPHEMERAL')
        .res('❌ ERROR: Invalid send time. Use a format like `8/13 7:00pm`.')
    }

    const contentFormatted = formatLineBreaks(content)

    const imageUrl = imageAttachment
      ? c.ref.attachments?.[imageAttachment]?.url
      : undefined

    await db
      .prepare(
        `
      INSERT INTO scheduled_messages (
        channel_id,
        created_by,
        content,
        image_url,
        send_time
      )
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .bind(
        destinationChannel,
        userId,
        content,
        imageUrl ?? null,
        sendDateTime.toUnixInteger(),
      )
      .run()

    if (imageAttachment) {
      const attachment = c.ref.attachments?.[imageAttachment]

      if (attachment?.url) {
        const blob = await fetch(attachment.url).then((res) => res.blob())

        return c.flags('EPHEMERAL').res(contentFormatted, {
          blob,
          name: attachment.filename,
        })
      }
    }

    return c.flags('EPHEMERAL').res(contentFormatted)
  },
)
