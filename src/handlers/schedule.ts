import {
  Button,
  Command,
  type CommandContext,
  Components,
  Content,
  Layout,
  Option,
  SubCommand,
} from 'discord-hono'
import { DateTime } from 'luxon'

import { factory } from '../init'
import { type BaseBindings, type ScheduledMessage } from '../types'
import { isAdmin, isTeamMember } from '../util'
import { formatLineBreaks, getFileNameFromUrl } from './helper'
import { parseSendTime } from './helper'

type ScheduleCommandContext = CommandContext<
  {
    Bindings: BaseBindings
  } & {
    Variables?:
      | ({
          destination_channel: string
        } & {
          title: string
        } & {
          content: string
        } & {
          send_time: string
        } & Partial<{
            image_attachment: string
          }>)
      | undefined
  }
>

export const command_schedule = factory.command(
  new Command('schedule', 'Manage scheduled messages.').options(
    new SubCommand(
      'create',
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
        'Message content - you can type "<br>" or "\\n" to insert a line break',
      ).required(),
      new Option(
        'send_time',
        'When to send the message in Pacific Time (example: 8/13 7:00pm)',
      ).required(),
      new Option('image_attachment', 'Optional image attachment', 'Attachment'),
    ),
    new SubCommand('list', 'List pending scheduled messages.'),
  ),

  /**
   * schedule command
   */
  async (c) => {
    switch (c.sub.command) {
      case 'create':
        return handleCreate(c)

      case 'list':
        return handleList(c)

      default:
        return c.flags('EPHEMERAL').res('Unknown schedule command.')
    }
  },
)

/**
 * schedule create subcommand
 */
const handleCreate = async (c: ScheduleCommandContext) => {
  const userId = c.interaction?.member?.user?.id

  if (!userId) {
    return c
      .flags('EPHEMERAL')
      .res('Unable to determine user sending the command.')
  }

  console.log(`Schedule create command received from: ${userId}`)
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
    .first<{ id: ScheduledMessage['id'] }>()

  if (!result) {
    return c.flags('EPHEMERAL').res('Failed to create scheduled message draft.')
  }

  console.log(`Draft message ${result.id} created.`)

  return c.flags('EPHEMERAL').res({
    content:
      `## Confirm Scheduled Message\n\n` +
      `**ID:** ${result.id}\n` +
      `**Title:** ${title}\n` +
      `**Channel:** <#${destinationChannel}>\n` +
      `**Send Time:** ${sendDateTime.toFormat('M/d/yyyy h:mm a ZZZZ')}`,
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
}

/**
 * schedule list subcommand
 */
const handleList = async (c: ScheduleCommandContext) => {
  const userId = c.interaction?.member?.user?.id

  if (!userId) {
    return c
      .flags('EPHEMERAL')
      .res('Unable to determine user sending the command.')
  }

  console.log(`Schedule list command received from: ${userId}`)

  const { results } = await c.env.DB.prepare(
    `
        SELECT id, title, channel_id, send_time
        FROM scheduled_messages
        WHERE status = 'pending'
        ORDER BY send_time ASC
      `,
  ).all<{
    id: ScheduledMessage['id']
    channel_id: ScheduledMessage['channel_id']
    title: ScheduledMessage['title']
    send_time: ScheduledMessage['send_time']
  }>()

  if (results.length === 0) {
    return c.flags('EPHEMERAL').res('There are no pending scheduled messages.')
  }

  return c.flags('EPHEMERAL', 'IS_COMPONENTS_V2').res({
    components: [
      new Content('## Scheduled Message List'),
      ...results.map((msg) => {
        const deleteButton = new Button(
          'schedule-delete',
          ['🗑️', 'Delete'],
          'Danger',
        ).custom_value(String(msg.id))

        return new Layout('Container').components(
          new Layout('Section')
            .components(
              new Content(
                `**ID:** ${msg.id}\n` +
                  `**Title:** ${msg.title}\n` +
                  `**Channel:** <#${msg.channel_id}>\n` +
                  `**Send Time:** ${DateTime.fromSeconds(msg.send_time, {
                    zone: 'America/Los_Angeles',
                  }).toFormat('M/d/yyyy h:mm a ZZZZ')}`,
              ),
            )
            .accessory(deleteButton),
        )
      }),
    ],
  })
}

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
        channel_id: ScheduledMessage['channel_id']
        title: ScheduledMessage['title']
        send_time: ScheduledMessage['send_time']
        status: ScheduledMessage['status']
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
        `**Send Time:** ${sendTimeFormatted}`,
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
      .first<{
        content: ScheduledMessage['content']
        image_url: ScheduledMessage['image_url']
      }>()

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

/**
 * Delete button handler
 */
export const component_schedule_delete = factory.component(
  new Button('schedule-delete', ['🗑️', 'Delete'], 'Danger'),
  async (c) => {
    const id = Number(c.ref.custom_value)

    if (!Number.isInteger(id)) {
      return c.update().res('Delete encountered invalid scheduled message ID.')
    }

    const result = await c.env.DB.prepare(
      `
    DELETE FROM scheduled_messages
    WHERE id = ?
      AND status = 'pending'
    RETURNING channel_id, title, send_time, status
  `,
    )
      .bind(id)
      .first<{
        channel_id: ScheduledMessage['channel_id']
        title: ScheduledMessage['title']
        send_time: ScheduledMessage['send_time']
        status: ScheduledMessage['status']
      }>()

    if (!result) {
      return c
        .update()
        .res(
          'A problem occurred and the scheduled message could not be deleted.',
        )
    }

    return c
      .update()
      .flags('IS_COMPONENTS_V2')
      .res({
        components: [
          new Content(
            `## 🗑️ Pending message deleted.\n\n` +
              `**ID:** ${id}\n` +
              `**Title:** ${result.title}\n` +
              `**Channel:** <#${result.channel_id}>\n` +
              `**Send Time:** ${DateTime.fromSeconds(result.send_time, {
                zone: 'America/Los_Angeles',
              }).toFormat('M/d/yyyy h:mm a ZZZZ')}`,
          ),
        ],
      })
  },
)
