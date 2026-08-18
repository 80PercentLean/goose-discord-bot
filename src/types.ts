import type { CommandContext } from 'discord-hono'

export type BaseBindings = CloudflareBindings & { DB: D1Database }

export interface MessageData {
  content: string
  flags?: number
}

export type ScheduleCommandContext = CommandContext<
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
          }> &
          Partial<{
            image_url: string
          }> &
          Partial<{
            suppress_embeds: boolean
          }>)
      | undefined
  }
>

export interface ScheduledMessage {
  id: number
  channel_id: string
  created_by: string
  title: string
  content: string
  image_url: string | null
  suppress_embeds: boolean
  send_time: number
  status: 'draft' | 'pending' | 'sent' | 'failed'
  attempts: number
  last_error: string | null
  created_at: number
  sent_at: number | null
}
