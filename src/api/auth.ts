import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

/**
 * Authorization middleware.
 * Require a valid API key for access to the API.
 */
export const auth = createMiddleware<{ Bindings: { API_KEY: string } }>(
  async (c, next) => {
    if (c.env.API_KEY) {
      const reqHeader = c.req.header('Authorization')
      const validHeader = `Bearer ${c.env.API_KEY}`

      if (reqHeader !== validHeader) {
        throw new HTTPException(401, { message: 'Unauthorized' })
      }
    } else {
      console.warn(
        'API_KEY was not set, so authorization middleware was not enabled. The API is currently not secured!',
      )
    }

    await next()
  },
)
