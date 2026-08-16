export type BaseBindings = CloudflareBindings & { DB: D1Database }

export interface ScheduledMessage {
  id: number
  channel_id: string
  created_by: string
  title: string
  content: string
  image_url: string | null
  send_time: number
  status: 'draft' | 'pending' | 'sent' | 'failed'
  attempts: number
  last_error: string | null
  created_at: number
  sent_at: number | null
}
