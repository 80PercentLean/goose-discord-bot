import { createFactory } from 'discord-hono'

import { type BaseBindings } from './types'

export const factory = createFactory<{
  Bindings: BaseBindings
}>()
