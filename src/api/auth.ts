import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

/**
 * Authorization middleware.
 * Require a valid API key for access to the API.
 */
export const auth = createMiddleware<{ Bindings: { API_KEY: string } }>(
  async (c, next) => {
    const reqHeader = c.req.header('Authorization')
    const validHeader = `Bearer ${c.env.API_KEY}`

    console.log(reqHeader, validHeader)

    if (reqHeader !== validHeader) {
      throw new HTTPException(401)
    }

    await next()
  },
)
