import {
  Button,
  Command,
  Components,
  Content,
  Layout,
  Option,
  SubCommand,
} from 'discord-hono'
import { DateTime } from 'luxon'

import { factory } from '../init'
import {
  type MessageData,
  type ScheduleCommandContext,
  type ScheduledMessage,
} from '../types'
import {
  cleanUpContent,
  formatLineBreaks,
  getFileNameFromUrl,
  validateUserPermissions,
} from './helper'
import { parseSendTime } from './helper'

type FlagsArray = ['EPHEMERAL'] | ['EPHEMERAL', 'SUPPRESS_EMBEDS']

/**
 * schedule command
 */
export const command_schedule = factory.command(
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

  async (c) => {
    switch (c.sub.command) {
      case 'new':
        return handleNew(c)

      case 'list':
        return handleList(c)

      case 'update':
        return handleUpdate(c)

      default:
        console.log('Unknown schedule command received.')
        return c.flags('EPHEMERAL').res('❌ Unknown schedule received.')
    }
  },
)

/**
 * schedule new subcommand
 */
const handleNew = async (c: ScheduleCommandContext) => {
  const userId = c.interaction?.member?.user?.id
  console.log(`Schedule new command received from: ${userId}`)
  console.log(c.var)

  if (!userId) {
    console.error('Unable to determine user sending the command.')
    return c
      .flags('EPHEMERAL')
      .res('❌ Unable to determine user sending the command.')
  }

  if (!validateUserPermissions(c.interaction)) {
    console.error(
      `User ${userId} does not have the permissions to use the schedule command.`,
    )
    return c.res('🚫 Goose Bot denies you.')
  }

  const {
    content,
    destination_channel: destinationChannel,
    image_attachment: imageAttachment,
    image_url: imageUrlInput,
    send_time: sendTime,
    suppress_embeds: suppressEmbeds,
    title,
  } = c.var

  const contentCleaned = cleanUpContent(content)

  // Check if content is still too long after clean up
  const contentTrueLength = formatLineBreaks(contentCleaned).length
  if (contentTrueLength > 2000) {
    console.error(
      `The cleaned message ended up being ${contentTrueLength} characters long. Please reduce the message to be at most 2000 characters.`,
    )
    return c
      .flags('EPHEMERAL')
      .res(
        `❌ The cleaned message ended up being ${contentTrueLength} characters long. Please reduce the message to be at most 2000 characters.`,
      )
  }

  // Validate the send time input
  const sendDateTime = parseSendTime(sendTime)

  if (!sendDateTime) {
    console.error('Invalid send time. Use a format like 8/13 7:00pm.')
    return c
      .flags('EPHEMERAL')
      .res('❌ Invalid send time. Use a format like `8/13 7:00pm`.')
  }

  // Setup the image if it is available
  let imageUrl
  if (imageAttachment) {
    imageUrl = c.ref.attachments?.[imageAttachment]?.url
  } else if (imageUrlInput) {
    imageUrl = imageUrlInput
  }

  // Create the draft in the database
  const result = await c.env.DB.prepare(
    `
      INSERT INTO scheduled_messages (
        channel_id,
        created_by,
        title,
        content,
        image_url,
        send_time,
        suppress_embeds
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
  )
    .bind(
      destinationChannel,
      userId,
      title,
      contentCleaned,
      imageUrl ?? null,
      sendDateTime.toUnixInteger(),
      suppressEmbeds ? true : false,
    )
    .first<{ id: ScheduledMessage['id'] }>()

  if (!result) {
    console.error('Failed to create scheduled message draft.')
    return c
      .flags('EPHEMERAL')
      .res('❌ Failed to create scheduled message draft.')
  }

  // Send the ephemeral message back to the author
  console.log(`Draft message ${result.id} created.`)
  return c.flags('EPHEMERAL').res({
    content:
      `## Confirm Scheduled Message\n\n` +
      `**ID:** ${result.id}\n` +
      `**Title:** ${title}\n` +
      `**Channel:** <#${destinationChannel}>\n` +
      `**Send Time:** ${sendDateTime.toFormat('M/d/yyyy h:mm a ZZZZ')}`,
    components: new Components().row(
      new Button('schedule-preview', ['🔍', 'Preview'], 'Primary').custom_value(
        String(result.id),
      ),
      new Button('schedule-confirm', ['✅', 'Confirm'], 'Success').custom_value(
        String(result.id),
      ),
      new Button('schedule-cancel', ['🗑️', 'Cancel'], 'Danger').custom_value(
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
  console.log(`Schedule list command received from: ${userId}`)

  if (!userId) {
    console.error('Unable to determine user sending the command.')
    return c
      .flags('EPHEMERAL')
      .res('❌ Unable to determine user sending the command.')
  }

  if (!validateUserPermissions(c.interaction)) {
    console.error(
      `User ${userId} does not have the permissions to use the schedule command.`,
    )
    return c.res('🚫 Goose Bot denies you.')
  }

  // Retrieve the pending messages from the database
  const { results } = await c.env.DB.prepare(
    `
        SELECT id, created_by, title, channel_id, send_time
        FROM scheduled_messages
        WHERE status = 'pending'
        ORDER BY send_time ASC
      `,
  ).all<{
    id: ScheduledMessage['id']
    created_by: ScheduledMessage['created_by']
    channel_id: ScheduledMessage['channel_id']
    title: ScheduledMessage['title']
    send_time: ScheduledMessage['send_time']
  }>()
  console.log(`List command encountered ${results.length} scheduled messages.`)

  if (results.length === 0) {
    // No pending scheduled messages were found, so let the commander know through an ephemeral message
    return c.flags('EPHEMERAL').res('There are no pending scheduled messages.')
  }

  // Pending scheduled messages were found, so list them to the commander through an ephemeral message
  return c.flags('EPHEMERAL', 'IS_COMPONENTS_V2').res({
    components: [
      new Content('## Scheduled Message List'),

      ...results.map((msg) => {
        return new Layout('Container').components(
          new Content(
            `**ID:** ${msg.id}\n` +
              `**Title:** ${msg.title}\n` +
              `**Channel:** <#${msg.channel_id}>\n` +
              `**Send Time:** ${DateTime.fromSeconds(msg.send_time, {
                zone: 'America/Los_Angeles',
              }).toFormat('M/d/yyyy h:mm a ZZZZ')}\n` +
              `**Author:** <@${msg.created_by}>`,
          ),

          new Layout('Action Row').components(
            new Button(
              'schedule-preview',
              ['🔍', 'Preview'],
              'Primary',
            ).custom_value(String(msg.id)),
            new Button(
              'schedule-delete',
              ['🗑️', 'Delete'],
              'Danger',
            ).custom_value(String(msg.id)),
          ),
        )
      }),
    ],
  })
}

/**
 * schedule update subcommand
 */
const handleUpdate = async (c: ScheduleCommandContext) => {
  const userId = c.interaction?.member?.user?.id
  console.log(`Schedule update command received from: ${userId}`)

  if (!userId) {
    console.error('Unable to determine user sending the command.')
    return c
      .flags('EPHEMERAL')
      .res('❌ Unable to determine user sending the command.')
  }

  if (!validateUserPermissions(c.interaction)) {
    console.error(
      `User ${userId} does not have the permissions to use the schedule command.`,
    )
    return c.res('🚫 Goose Bot denies you.')
  }

  const {
    content,
    discord_id: discordId,
    image_attachment: imageAttachment,
    image_url: imageUrlInput,
    remove_image: removeImage,
    suppress_embeds: suppressEmbeds,
  } = c.var

  const contentCleaned = cleanUpContent(content)

  // Check if content is still too long after clean up
  const contentFormatted = formatLineBreaks(contentCleaned)
  if (contentFormatted.length > 2000) {
    console.error(
      `The cleaned message ended up being ${contentFormatted.length} characters long. Please reduce the message to be at most 2000 characters.`,
    )
    return c
      .flags('EPHEMERAL')
      .res(
        `❌ The cleaned message ended up being ${contentFormatted.length} characters long. Please reduce the message to be at most 2000 characters.`,
      )
  }

  // Find Discord message in scheduled message history
  const result = await c.env.DB.prepare(
    `
    SELECT channel_id
    FROM scheduled_messages
    WHERE discord_id = ?
  `,
  )
    .bind(discordId)
    .first<{ channel_id: ScheduledMessage['channel_id'] }>()

  if (!result) {
    console.error(
      'A problem occurred and the sent scheduled message could not be found.',
    )
    return c
      .flags('EPHEMERAL')
      .res(
        '❌ A problem occurred and the sent scheduled message could not be found.',
      )
  }

  try {
    // Setup the image if it is available
    let img
    let imageUrl
    const data: MessageData = {
      content: contentFormatted,
    }

    if (removeImage) {
      // Setting attachments to an empty array will delete an existing image
      // This condition also prevents any other images from being attached if they were sent with the command
      data.attachments = []
    } else if (imageAttachment) {
      imageUrl = c.ref.attachments?.[imageAttachment]?.url
    } else if (imageUrlInput) {
      imageUrl = imageUrlInput
    }

    if (imageUrl) {
      const imageRes = await fetch(imageUrl)
      if (!imageRes.ok) {
        throw new Error(
          `Failed to fetch image: ${imageRes.status} ${imageRes.statusText}`,
        )
      }

      const blob = await imageRes.blob()
      img = {
        blob,
        name: getFileNameFromUrl(imageUrl),
      }
    }

    // Update the sent scheduled message
    if (suppressEmbeds) {
      data.flags = 4
    }
    if (img) {
      data.attachments = [
        {
          id: '0',
          filename: img.name,
        },
      ]
    }

    const messageRes = await c.rest(
      'PATCH',
      '/channels/{channel.id}/messages/{message.id}',
      [result.channel_id, discordId],
      data,
      img,
    )

    if (!messageRes.ok) {
      const body = await messageRes.text()
      throw new Error(body)
    }
  } catch (err) {
    const errMsg =
      'Encountered an error while updating the sent scheduled message.'
    const errLog = err instanceof Error ? err.message : String(err)
    console.error(errMsg)
    console.error(errLog)
    return c
      .flags('EPHEMERAL')
      .res(`❌ Encountered an error while updating the sent scheduled message.`)
  }

  console.log(`Sent scheduled message ${discordId} was updated.`)

  // Send public message back to commander to record update
  const messageUrl =
    `https://discord.com/channels/` +
    `${c.env.DISCORD_TEST_GUILD_ID}/${result.channel_id}/${discordId}`
  return c.res(
    `<@${userId}> updated sent scheduled message [${discordId}](${messageUrl}).`,
  )
}

/**
 * Confirm button handler
 */
export const component_schedule_confirm = factory.component(
  new Button('schedule-confirm', 'Confirm'),
  async (c) => {
    const id = Number(c.ref.custom_value)

    if (!Number.isInteger(id)) {
      console.error('Confirm encountered invalid scheduled message ID')
      return c
        .update()
        .res('❌ Confirm encountered invalid scheduled message ID.')
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
      console.error(
        'A problem occurred and this scheduled message draft may not have been set to pending.',
      )
      return c
        .update()
        .res(
          '❌ A problem occurred and this scheduled message draft may not have been set to pending.',
        )
    }

    if (result.status !== 'pending') {
      console.error(
        'A problem occurred and this scheduled message draft was not set to pending.',
      )
      return c
        .update()
        .res(
          '❌ A problem occurred and this scheduled message draft was not set to pending.',
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
        new Button(
          'schedule-preview',
          ['🔍', 'Preview'],
          'Primary',
        ).custom_value(String(id)),
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
      console.error('Cancel encountered invalid scheduled message ID.')
      return c
        .update()
        .res('❌ Cancel encountered invalid scheduled message ID.')
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
      console.error(
        'A problem occurred and this scheduled message draft was not deleted.',
      )
      return c
        .update()
        .res(
          '❌ A problem occurred and this scheduled message draft was not deleted.',
        )
    }

    console.log(`Draft message ${id} deleted.`)
    return c.update().res({
      content: `## 🗑️ Scheduled message canceled.\n\n` + `**ID:** ${id}`,
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
      console.error('Preview encountered invalid scheduled message ID.')
      return c
        .update()
        .res('❌ Preview encountered invalid scheduled message ID.')
    }

    const result = await c.env.DB.prepare(
      `
          SELECT content, image_url, suppress_embeds
          FROM scheduled_messages
          WHERE id = ?;
        `,
    )
      .bind(id)
      .first<{
        content: ScheduledMessage['content']
        image_url: ScheduledMessage['image_url']
        suppress_embeds: ScheduledMessage['suppress_embeds']
      }>()

    if (!result) {
      console.error(
        'A problem occurred and the scheduled message could not be found.',
      )
      return c
        .update()
        .res(
          '❌ A problem occurred and the scheduled message could not be found.',
        )
    }

    const contentFormatted = formatLineBreaks(result.content)

    let img
    if (result.image_url) {
      const blob = await fetch(result.image_url).then((res) => res.blob())
      img = {
        blob,
        name: getFileNameFromUrl(result.image_url),
      }
    }

    const flags: FlagsArray = result.suppress_embeds
      ? ['EPHEMERAL', 'SUPPRESS_EMBEDS']
      : ['EPHEMERAL']

    console.log(`Previewed message ${id}.`)
    return c.flags(...flags).res(
      {
        content: contentFormatted,
      },
      img,
    )
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
      console.error('Delete encountered invalid scheduled message ID.')
      return c
        .update()
        .flags('IS_COMPONENTS_V2')
        .res({
          components: [
            new Content('❌ Delete encountered invalid scheduled message ID.'),
          ],
        })
    }

    const result = await c.env.DB.prepare(
      `
      DELETE FROM scheduled_messages
      WHERE id = ?
        AND status = 'pending'
      RETURNING created_by, channel_id, title, send_time, status
    `,
    )
      .bind(id)
      .first<{
        created_by: ScheduledMessage['created_by']
        channel_id: ScheduledMessage['channel_id']
        title: ScheduledMessage['title']
        send_time: ScheduledMessage['send_time']
        status: ScheduledMessage['status']
      }>()

    if (!result) {
      console.error(
        'A problem occurred and the scheduled message could not be deleted.',
      )
      return c
        .update()
        .flags('IS_COMPONENTS_V2')
        .res({
          components: [
            new Content(
              '❌ A problem occurred and the scheduled message could not be deleted.',
            ),
          ],
        })
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
              }).toFormat('M/d/yyyy h:mm a ZZZZ')}\n` +
              `**Author:** <@${result.created_by}>`,
          ),
        ],
      })
  },
)
