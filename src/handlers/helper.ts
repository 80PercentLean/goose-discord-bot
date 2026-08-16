import { DateTime } from 'luxon'

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
