import { Button } from 'discord-hono'
import { DateTime } from 'luxon'

import { factory } from '../init'

export const component_schedule_confirm = factory.component(
  new Button('schedule-confirm', 'Confirm'),
  async (c) => {
    const id = Number(c.ref.custom_value)

    if (!Number.isInteger(id)) {
      return c.update().res('Invalid scheduled message ID.')
    }

    const result = await c.env.DB.prepare(
      `
          UPDATE scheduled_messages
          SET status = 'pending'
          WHERE id = ?
            AND status = 'draft'
          RETURNING title, status, send_time
        `,
    )
      .bind(id)
      .first<{
        title: string
        status: string
        send_time: number
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
        `**ID:** ${id}\n\n` +
        `**Title:** ${result.title}\n\n` +
        `**Send time:** ${sendTimeFormatted}`,
      components: [],
    })
  },
)

export const component_schedule_cancel = factory.component(
  new Button('schedule-cancel', 'Cancel'),
  async (c) => {
    const id = Number(c.ref.custom_value)

    if (!Number.isInteger(id)) {
      return c.update().res('Invalid scheduled message ID.')
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
