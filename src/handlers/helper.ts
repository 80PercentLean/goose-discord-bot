import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { DateTime } from 'luxon'

import { isAdmin, isTeamMember } from '../util'

/**
 * Cleans up the input from the content option by removing actual line breaks.
 * Multiline Discord inputs can break some markdown formatting when the message is sent,
 * so this prevents that.
 * @param content Input from the content option
 */
export const cleanUpContent = (content: string) =>
  content.replace(/\r\n|\r|\n/g, '')

/**
 * Convert \\n and <br> in content into true line breaks.
 * @param content Input from the content option
 * @returns String with true line breaks
 */
export const formatLineBreaks = (content: string) =>
  content.replaceAll('\\n', '\n').replace(/<br\s*\/?>/gi, '\n')

/**
 * Get the file name from an image URL.
 * @param url URL of image
 * @returns File name
 */
export const getFileNameFromUrl = (url: string): string => {
  const fileName = new URL(url).pathname.split('/').pop()

  if (!fileName) {
    throw new Error('Could not get file name from URL.')
  }

  return fileName
}

/**
 * Parse the input from the send_time option.
 * @param input Input from the send_time option
 * @returns Luxon DateTime instance
 */
export const parseSendTime = (input: string): DateTime | null => {
  const zone = 'America/Los_Angeles'
  const now = DateTime.now().setZone(zone)

  const normalized = input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*(am|pm)$/i, (_, period) => ` ${period.toUpperCase()}`)

  let date = DateTime.fromFormat(
    `${normalized} ${now.year}`,
    'M/d h:mm a yyyy',
    {
      zone,
      locale: 'en-US',
    },
  )

  if (!date.isValid) {
    return null
  }

  if (date <= now) {
    date = DateTime.fromFormat(
      `${normalized} ${now.year + 1}`,
      'M/d h:mm a yyyy',
      {
        zone,
        locale: 'en-US',
      },
    )
  }

  return date.isValid ? date : null
}

/**
 * Check if the user has the valid permissions.
 * @param interaction Discord interaction
 * @returns True when the user does have valid permissions, false otherwise
 */
export const validateUserPermissions = (
  interaction: APIApplicationCommandInteraction,
) => {
  if (
    !isAdmin(interaction.member?.permissions) &&
    !isTeamMember(interaction.member?.roles)
  ) {
    return false
  }
  return true
}
