import { Button, Command, Components, Option } from 'discord-hono'

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
      'title',
      "Scheduler title. The audience won't see this, but it's used for identifying the scheduled message when looking up pending messages held by the bot.",
    ).required(),
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

    if (!userId) {
      return c
        .flags('EPHEMERAL')
        .res('Unable to determine user sending the command.')
    }

    console.log(`Schedule command received from: ${userId}`)
    console.log(c.var)

    if (
      !isAdmin(c.interaction.member?.permissions) &&
      !isTeamMember(c.interaction.member?.roles)
    ) {
      console.log(
        `User ${userId} does not have the permissions to use the schedule command.`,
      )
      return c.res('Goose Bot denies you.')
    }

    const {
      content,
      destination_channel: destinationChannel,
      image_attachment: imageAttachment,
      send_time: sendTime,
      title,
    } = c.var

    // Validate the send time input
    const sendDateTime = parseSendTime(sendTime)

    if (!sendDateTime) {
      return c
        .flags('EPHEMERAL')
        .res('❌ ERROR: Invalid send time. Use a format like `8/13 7:00pm`.')
    }

    // const contentFormatted = formatLineBreaks(content)

    const imageUrl = imageAttachment
      ? c.ref.attachments?.[imageAttachment]?.url
      : undefined

    const db = c.env.DB
    const result = await db
      .prepare(
        `
      INSERT INTO scheduled_messages (
        channel_id,
        created_by,
        title,
        content,
        image_url,
        send_time
      )
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
      )
      .bind(
        destinationChannel,
        userId,
        title,
        content,
        imageUrl ?? null,
        sendDateTime.toUnixInteger(),
      )
      .first<{ id: number }>()

    if (!result) {
      return c
        .flags('EPHEMERAL')
        .res('Failed to create scheduled message draft.')
    }

    console.log(`Draft message ${result.id} created.`)

    const components = new Components().row(
      new Button('schedule-confirm', 'Confirm', 'Success').custom_value(
        String(result.id),
      ),

      new Button('schedule-cancel', 'Cancel', 'Danger').custom_value(
        String(result.id),
      ),
    )

    return c.flags('EPHEMERAL').res({
      content:
        `## Confirm Scheduled Message\n\n` +
        `**Channel:** <#${destinationChannel}>\n` +
        `**Send time:** ${sendDateTime.toFormat('M/d/yyyy h:mm a ZZZZ')}\n\n` +
        // `**Message:**\n${formatLineBreaks(content)}`,

        components,
    })

    // if (imageAttachment) {
    //   const attachment = c.ref.attachments?.[imageAttachment]

    //   if (attachment?.url) {
    //     const blob = await fetch(attachment.url).then((res) => res.blob())

    //     return c.flags('EPHEMERAL').res(contentFormatted, {
    //       blob,
    //       name: attachment.filename,
    //     })
    //   }
    // }

    // return c.flags('EPHEMERAL').res(contentFormatted)
  },
)
