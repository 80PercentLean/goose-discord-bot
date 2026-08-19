import { Command, Option } from 'discord-hono'

import { factory } from '../init'
import type { MessageData } from '../types'
import {
  cleanUpContent,
  formatLineBreaks,
  getFileNameFromUrl,
  validateUserPermissions,
} from './helper'

/**
 * forceEdit command
 */
export const command_forceEdit = factory.command(
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

  async (c) => {
    const userId = c.interaction?.member?.user?.id
    console.log(`Force edit command received from: ${userId}`)

    if (!userId) {
      console.error('Unable to determine user sending the command.')
      return c
        .flags('EPHEMERAL')
        .res('❌ Unable to determine user sending the command.')
    }

    if (!validateUserPermissions(c.interaction)) {
      console.error(
        `User ${userId} does not have the permissions to use the force edit command.`,
      )
      return c.res('🚫 Goose Bot denies you.')
    }

    const {
      content,
      channel_id: channelId,
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

      // Update the Discord message
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
        [channelId, discordId],
        data,
        img,
      )

      if (!messageRes.ok) {
        const body = await messageRes.text()
        throw new Error(body)
      }
    } catch (err) {
      const errMsg = 'Encountered an error while force editing the message.'
      const errLog = err instanceof Error ? err.message : String(err)
      console.error(errMsg)
      console.error(errLog)
      return c
        .flags('EPHEMERAL')
        .res(`❌ Encountered an error while force editing the message.`)
    }

    console.log(`Message ${discordId} was force edited.`)

    // Send public message back to commander to record force edit
    const messageUrl =
      `https://discord.com/channels/` +
      `${c.env.DISCORD_TEST_GUILD_ID}/${channelId}/${discordId}`
    return c.res(
      `<@${userId}> force edited message [${discordId}](${messageUrl}).`,
    )
  },
)
