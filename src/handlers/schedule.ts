import { Button, Command, Components, Option } from 'discord-hono'
import { DateTime } from 'luxon'

import { factory } from '../init'
import { isAdmin, isTeamMember } from '../util'
import { formatLineBreaks, getFileNameFromUrl } from './helper'
import { parseSendTime } from './helper'

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

    const imageUrl = imageAttachment
      ? c.ref.attachments?.[imageAttachment]?.url
      : undefined

    const result = await c.env.DB.prepare(
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

    return c.flags('EPHEMERAL').res({
      content:
        `## Confirm Scheduled Message\n\n` +
        `**ID:** ${result.id}\n` +
        `**Title:** ${title}\n` +
        `**Channel:** <#${destinationChannel}>\n` +
        `**Send Time:** ${sendDateTime.toFormat('M/d/yyyy h:mm a ZZZZ')}\n\n`,
      components: new Components().row(
        new Button('schedule-preview', 'Preview', 'Primary').custom_value(
          String(result.id),
        ),
        new Button('schedule-confirm', 'Confirm', 'Success').custom_value(
          String(result.id),
        ),
        new Button('schedule-cancel', 'Cancel', 'Danger').custom_value(
          String(result.id),
        ),
      ),
    })
  },
)

/**
 * Confirm button handler
 */
export const component_schedule_confirm = factory.component(
  new Button('schedule-confirm', 'Confirm'),
  async (c) => {
    const id = Number(c.ref.custom_value)

    if (!Number.isInteger(id)) {
      return c.update().res('Confirm encountered invalid scheduled message ID.')
    }

    const result = await c.env.DB.prepare(
      `
          UPDATE scheduled_messages
          SET status = 'pending'
          WHERE id = ?
            AND status = 'draft'
          RETURNING channel_id, title, send_time, status
        `,
    )
      .bind(id)
      .first<{
        channel_id: string
        title: string
        send_time: number
        status: string
      }>()

    if (!result) {
      return c
        .flags('EPHEMERAL')
        .res(
          'A problem occurred and this scheduled message draft may not have been set to pending.',
        )
    }

    if (result.status !== 'pending') {
      return c
        .update()
        .res(
          'A problem occurred and this scheduled message draft was not set to pending.',
        )
    }

    const sendTimeFormatted = DateTime.fromSeconds(result.send_time)
      .setZone('America/Los_Angeles')
      .toFormat('M/d/yyyy h:mm a ZZZZ')

    console.log(`Scheduled message ${id} for ${sendTimeFormatted}.`)

    return c.update().res({
      content:
        `## ✅ Message scheduled successfully!\n\n` +
        `**ID:** ${id}\n` +
        `**Title:** ${result.title}\n` +
        `**Channel:** <#${result.channel_id}>\n` +
        `**Send Time:** ${sendTimeFormatted}\n\n`,
      components: new Components().row(
        new Button('schedule-preview', 'Preview', 'Primary').custom_value(
          String(id),
        ),
      ),
    })
  },
)

/**
 * Cancel button handler
 */
export const component_schedule_cancel = factory.component(
  new Button('schedule-cancel', 'Cancel'),
  async (c) => {
    const id = Number(c.ref.custom_value)

    if (!Number.isInteger(id)) {
      return c.update().res('Cancel encountered invalid scheduled message ID.')
    }

    const result = await c.env.DB.prepare(
      `
          DELETE FROM scheduled_messages
          WHERE id = ?
            AND status = 'draft'
        `,
    )
      .bind(id)
      .run()

    if (!result.meta.changes) {
      return c
        .update()
        .res(
          'A problem occurred and this scheduled message draft was not deleted.',
        )
    }

    console.log(`Draft message ${id} deleted.`)

    return c.update().res({
      content: `## ❌ Scheduled message canceled.\n\n` + `**ID:** ${id}`,
      components: [],
    })
  },
)

/**
 * Preview button handler
 */
export const component_schedule_preview = factory.component(
  new Button('schedule-preview', 'Preview Message'),
  async (c) => {
    const id = Number(c.ref.custom_value)

    if (!Number.isInteger(id)) {
      return c.update().res('Preview encountered invalid scheduled message ID.')
    }

    const result = await c.env.DB.prepare(
      `
          SELECT *
          FROM scheduled_messages
          WHERE id = ?;
        `,
    )
      .bind(id)
      .first<{ content: string; image_url: string | null }>()

    if (!result) {
      return c
        .flags('EPHEMERAL')
        .res('A problem occurred and the scheduled message could not be found.')
    }

    const contentFormatted = formatLineBreaks(result.content)

    if (result.image_url) {
      const blob = await fetch(result.image_url).then((res) => res.blob())

      return c.flags('EPHEMERAL').res(contentFormatted, {
        blob,
        name: getFileNameFromUrl(result.image_url),
      })
    }

    console.log(`Previewed message ${id}.`)

    return c.flags('EPHEMERAL').res({
      content: contentFormatted,
    })
  },
)
