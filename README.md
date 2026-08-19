# Goose Discord Bot

This project is a [Discord bot](https://docs.discord.com/developers/bots/overview) built for the [Cupertino PoGO](https://www.cupertinopogo.com) and [Wild Goose](https://www.wildgoosepogo.com) groups.

Some notable features are:

- Provides a REST API that exposes the Discord server's event data so it can be used for the meetups view in the [Cupertino PoGO Map project](https://github.com/80PercentLean/cupertino-pogo-map).
- Provides a message scheduling commands that allow the bot to send messages for announcements and reminders in the future.
- The bot runs on Cloudflare Workers, so it operates on a serverless, edge-computing platform.
- Completely open source!

## Quick Start

### 1. Install dependencies.

```shell
npm install
```

### 2. Setup environment variables.

Rename [`.env.example`](./env.example) to `.env` and set the following environment variables:

- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_TOKEN`
- `DISCORD_TEST_GUILD_ID`

It is important to set `DISCORD_TEST_GUILD_ID` so the register script will configure the commands to a specific Discord server. Global and guild commands are different, and these commands were built with the intention of being guild-specific, so we don't recommend register globally. `DISCORD_TEST_GUILD_ID` is also required for the `force_edit` command to work.

You can also optionally set `API_KEY` to secure the API.

### 3. Setup Cloudflare Worker secrets.

Set your [Cloudflare Worker's secrets](https://developers.cloudflare.com/workers/configuration/secrets/):

```shell
npx wrangler secret put DISCORD_APPLICATION_ID
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_TOKEN
npx wrangler secret put DISCORD_TEST_GUILD_ID
```

Optionally, if you want to secure the API, set `API_KEY`:

```shell
npx wrangler secret put API_KEY
```

### 4. Register and deploy.

```shell
npm run register
npm run deploy
```

## Other Resources

- [Motivation](./docs/motivation.md)
- [Discord Bot Commands](./docs/bot-commands.md)
- [Contributing](./docs/contributing.md)
- [Working With Tests](./docs/testing.md)

## Technology Overview

- [TypeScript](https://www.typescriptlang.org): Main language used for its type safety
- [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript): Language used for some scripts & configuration files
- [Cloudflare Workers](https://cloudflare.com/products/workers): Serverless edge computing platform used to host the Discord bot and REST API
- [Discord Hono](https://discord-hono.luis.fun): Library for building Discord bots on Cloudflare Workers
- [Hono](https://hono.dev): Web application framework that supports Cloudflare Workers
- [Cloudflare D1](https://developers.cloudflare.com/d1): Serverless database used for persisting data
- [Cloudflare Workers KV](https://developers.cloudflare.com/kv): Key-value data storage used for caching Discord API responses
- [Luxon](https://moment.github.io/luxon): Library for dealing with dates and times
- [EJS](https://ejs.co): Templating language used to generate HTML
- [Vitest](https://vitest.dev): Framework for unit testing
- [ESLint](https://eslint.org): Code linter
- [Prettier](https://prettier.io): Code formatter

## Other

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```shell
npm run cf-typegen
```

## License

Goose Discord Bot is open source software licensed as [MIT](./LICENSE).
