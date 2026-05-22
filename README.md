# Goose Discord Bot

This project is a [Discord bot](https://docs.discord.com/developers/bots/overview) built for the [Cupertino PoGO](https://tinyurl.com/CupertinoPogo) and [Wild Goose](https://campfire.onelink.me/eBr8?af_dp=campfire://&af_force_deeplink=true&deep_link_sub1=cj1jbHVicyZjPWE4M2FmMzljLTRiNTgtNGM2NC1iZjViLTYwMTM4Yzc2MzNjNyZpPXRydWU=) groups.

It also provides a REST API that exposes the community Discord server data for use by the [Cupertino PoGO Map project](https://github.com/80PercentLean/cupertino-pogo-map).

## Quick Start

### 1. Install dependencies.

```shell
npm install
```

### 2. Setup environment variables.

Rename [`.env.example`](./env.example) to `.env` and set the following environment variables:

- DISCORD_APPLICATION_ID
- DISCORD_PUBLIC_KEY
- DISCORD_TOKEN

Optionally, set `DISCORD_TEST_GUILD_ID` to register commands to a specific Discord server. Without this, commands will be registered globally which can take some time to reflect your changes, so if you want to register commands immediately, set this to a Discord server you are testing on.

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

## Technology Overview

- [TypeScript](https://www.typescriptlang.org): Main language used for its type safety
- [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript): Language used for some scripts & configuration files
- [Discord Hono](https://discord-hono.luis.fun): Library for building Discord bots on Cloudflare Workers
- [Hono](https://hono.dev): Web application framework that supports Cloudflare Workers
- [EJS](https://ejs.co): Templating language used to generate HTML

## Other

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```shell
npm run cf-typegen
```
