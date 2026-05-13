import { Hono } from "hono"

import { events } from "./events"

// API path will be at /api/v1
export const api = new Hono().basePath("/v1")

api.route("/events", events)
