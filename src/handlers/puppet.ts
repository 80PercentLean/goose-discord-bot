import { $channels$_$messages, Command, Option, createRest } from 'discord-hono'

import { factory } from '../init'
import type { MessageData } from '../types'
import {
  formatLineBreaks,
  getFileNameFromUrl,
  validateUserPermissions,
} from './helper'

/**
 * puppet command
 */
export const command_puppet = factory.command(
  new Command(
    'puppet',
    'Control Goose Bot to say something instantly.',
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
      'Message content - you can type "<br>" or "\\n" to insert a line break (2000 character limit)',
    ).required(),
    new Option('image_attachment', 'Optional image attachment', 'Attachment'),
    new Option('image_url', 'Optional image URL'),
    new Option('suppress_embeds', 'Do not include embeds when true', 'Boolean'),
  ),

  async (c) => {
    const userId = c.interaction?.member?.user?.id
    console.log(`Puppet command received from: ${userId}`)
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
      return c.res('Goose Bot denies you.')
    }

    const {
      content,
      destination_channel: destinationChannel,
      image_attachment: imageAttachment,
      image_url: imageUrlInput,
      suppress_embeds: suppressEmbeds,
    } = c.var

    const rest = createRest(c.env.DISCORD_TOKEN)

    try {
      let img
      let imageUrl

      if (imageAttachment) {
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

      // Send the scheduled message
      const data: MessageData = {
        content: formatLineBreaks(content),
      }
      if (suppressEmbeds) {
        data.flags = 4
      }

      const messageRes = await rest(
        'POST',
        $channels$_$messages,
        [destinationChannel],
        data,
        img,
      )

      if (!messageRes.ok) {
        const body = await messageRes.text()
        throw new Error(body)
      }
    } catch (err) {
      const errMsg = `Encountered an error while puppeting.`
      const errLog = err instanceof Error ? err.message : String(err)
      console.error(errMsg)
      console.error(errLog)
    }

    return c.res(`<@${userId}> puppeteered Goose Bot.`)
  },
)
