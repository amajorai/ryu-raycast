# <img src="https://raw.githubusercontent.com/amajorai/ryu/main/.github/logo.png" width="50" align="center" alt="" />&nbsp; Ryu for Raycast

> Pipe your existing Raycast setup into Ryu. Part of [Ryu](https://github.com/amajorai/ryu).

[![Docs](https://shieldcn.dev/badge/Docs-ryuhq.com-73DC8C.svg?logo=readthedocs&logoColor=white)](https://ryuhq.com/help)
[![License](https://shieldcn.dev/badge/License-MIT-73DC8C.svg?logo=opensourceinitiative&logoColor=white)](./LICENSE)
[![Stack](https://shieldcn.dev/badge/TypeScript-Raycast-FF6363.svg?logo=raycast&logoColor=white)](https://github.com/amajorai/ryu)
[![Discord](https://shieldcn.dev/discord/1439211418724597800.svg?logo=discord&logoColor=white&color=4B78E6)](https://ryuhq.com/discord)
[![X](https://shieldcn.dev/badge/Follow-@ryuhq-FA9BFA.svg?logo=x&logoColor=white)](https://twitter.com/ryuhq)

A Raycast extension (macOS **and** Windows) for people who already live in the launcher: Ask Ryu (one-shot, streamed), Chat with Ryu (multi-turn), and Search Conversations. It hits Core directly (Raycast commands run in Node with no browser Origin, so no CORS proxy). It is fenced out of the Bun/Turbo workspace and uses Raycast's own `ray` toolchain. For a standalone always-on-top launcher instead, use the **Ryu Island** command bar (`apps/island`, summoned by the global hotkey).

**Tier:** OSS (MIT)

## Stack

- Raycast `@raycast/api` + `@raycast/utils` + React + TypeScript
- Talks to Core (`http://localhost:7980`) directly
- Own `ray` CLI toolchain (fenced from the monorepo workspace)

## Develop

Not part of the Bun/Turbo loop. Install and run on its own with the `ray` CLI:

```sh
cd apps/raycast
npm install
npm run dev      # ray develop: opens it in your local Raycast
npm run build    # ray build: type-checks + bundles
```

`ray develop` / `ray build` require Raycast installed and a signed-in account. Run Ryu Core locally first (the desktop app starts it on `:7980`).

## What it does

- **Ask Ryu.** A one-shot question, streamed into a Detail view.
- **Chat with Ryu.** A multi-turn conversation.
- **Search Conversations.** Browse Ryu Core conversation history.

## License

MIT. See [LICENSE](./LICENSE).
