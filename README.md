# CrossvilleShared

A separate JavaScript prototype for the loop **personal Codex conversation → connector → reviewed team context → same Codex conversation**.

The MCP server and browser preview use the same local SQLite store. Codex supplies the real LLM response; the browser prepares and inspects context, without pretending to run a model.

## Hosted preview and source

- Private hosted preview: https://crossvilleshared.kartika-pinjarkar48.chatgpt.site
- Private source repository: https://github.com/kartika6/CrossvilleShared

The hosted preview uses persistent Cloudflare D1 storage behind Sites sign-in. Its fictional workspace is separate from the local MCP server’s SQLite workspace; they are not synchronized. The live team backend remains a separate integration.

## Run the preview

Requires Node.js 24 or later.

```sh
npm install
npm start
```

Open [CrossvilleShared locally](http://127.0.0.1:4317). Keep the terminal running. Stop with Ctrl+C. To use a different port, set `CROSSVILLE_PORT` when starting the server.

The workspace is fictional, local and single-user. Alex, Sam and Professor are sample attributions. The reviewer controls exercise local application rules, not real multi-account authentication. This does not change Leyi's site, team data, existing chats or hosting permissions.

## Connect Codex

In Codex MCP settings add a local **STDIO** server named `crossville_shared`:

- Command: the absolute path to your Node.js executable (`command -v node`).
- Arguments: the absolute path to this project's `src/mcp-server.js`, as one argument.

The preview's **Connect to Codex** page shows the exact values for this machine. The server is started by Codex; the browser server does not have to be running for the MCP tools to work.

Alternatively, from this project directory:

```sh
codex mcp add crossville_shared -- node "$(pwd)/src/mcp-server.js"
```

This command registers the server persistently in Codex configuration. It is provided for you to run; this project has not changed your global MCP configuration. Reconnect/restart the host as its settings require, then check that the tools are available.

Try this in a connected chat:

> Use CrossvilleShared to get the current team context for planning our pilot schedule, in auto mode. Then make the schedule using that context. Name the context version and approved duration you used.

For a preview:

> Get the current CrossvilleShared context in preview mode. Show me the selected items and sources, and wait for my edits or confirmation before using the packet to answer.

The host calls the tool and receives its result in that same conversation. Copy/download remain optional fallbacks. Tool instructions recommend checking current context, but they do not guarantee a tool call before every future answer. A cold chat catches up on its next retrieval; there is no background push into every chat.

## Tools

| Tool | Behavior |
| --- | --- |
| `get_team_context` | Retrieves current approved context using task keywords plus required brief/constraints; returns directly or prepares a preview |
| `confirm_handoff` | Finalizes a human-reviewed preview, selected items, permitted personal edits and a personal task note |
| `cancel_handoff` | Cancels an open preview |
| `list_team_context` | Lists approved shared records and proposals for choosing a replacement target |
| `prepare_proposal` | Stores an editable private draft; an explicit target produces a before/after comparison |
| `submit_proposal` | Submits an exact draft after confirmation; repeating that draft returns the same proposal |

Reviewer approval is deliberately separate from the MCP contribution tools. Use the browser's **Review inbox** to exercise approval/rejection in the fictional workspace.

## Try the loop

1. Retrieve a pilot schedule packet. A newly created database begins at v2 with a two-week decision.
2. In preview mode, edit an optional context item or add a personal note; confirm it. Team records do not change. Required context cannot be removed or rewritten here.
3. Prepare a proposal that replaces the pilot duration with one week. Review the exact before/after and submit it. It remains pending.
4. In the local review inbox, approve it. Context advances to the next version. Prior packets stay historical snapshots, and open stale previews cannot be confirmed.
5. Retrieve again in Codex. The same tools return the new approved duration. Pass `known_version` to inspect differences from a previous version.

The development walkthrough has already exercised v2 → v3 in the default local database, so your first opening may show the approved one-week decision and that history. Tests use disposable, separate databases.

## Verification

```sh
npm test
npm run check
npm run demo
```

The tests cover MCP discovery/calls, the built hosted Worker with identity and D1 storage, browser API routes, stale versions, mandatory context, personal-edit isolation, draft ownership, reviewer roles, idempotent submission and SQLite persistence. `npm run demo` exercises the version-change loop in memory without changing your preview data.

An actual Codex check was performed with isolated fictional data. Codex called `get_team_context` and answered with v2, the approved two-week/14-day duration, and the fictional-data constraint. It did not use a copied packet or read real team data. The raw event record is saved locally under `artifacts/codex-smoke.jsonl`.

To repeat the actual-model check, which uses your Codex allowance:

```sh
node scripts/verify-codex.js
```

By default it uses the Codex CLI bundled with the ChatGPT macOS app. Set `CROSSVILLE_CODEX_BIN` if your CLI is elsewhere. It runs ephemerally with only this MCP connection configured, uses a separate disposable database and checks the returned evidence. No global MCP configuration is changed by this check.

## What's connected

- Real MCP transport, structured tool results and Codex model interaction.
- Real local persistence, proposal/review transitions, version checks and immutable finalized packets.
- Browser preview, local edits, source explanations, copy fallback and optional JSON export.

The live Crossville site, real teammate identities, chat-history ingestion, semantic retrieval/conflict detection and automatic monitoring are not connected. See [the backend integration contract](docs/TEAM_BACKEND.md) for the concrete work needed next.

## Project structure

```text
src/fixture.js       Fictional project seed
src/store.js         Local transactional SQLite store
src/memory-store.js  Hosted transaction state
worker/index.js      Private hosted adapter with D1 version checks
src/domain.js        Selection, version differences and packet formatting
src/service.js       Handoff and proposal/review rules
src/tools.js         MCP tool schemas and shared dispatch
src/mcp-server.js    Real MCP STDIO server
src/web-server.js    Loopback-only browser server
public/              Plain HTML, CSS and JavaScript preview
tests/               Service, HTTP, MCP-client and hosted adapter tests
scripts/             Checks, isolated demo and actual Codex verification
docs/TEAM_BACKEND.md Live integration requirements
```

JavaScript is intentional for this first prototype. The interfaces and Zod schemas can move to TypeScript without changing the tool names or user flow.

## Local data and access

The default database is `.data/workspace.sqlite`, ignored by Git. Both MCP and the preview resolve this path relative to the project, not the caller's working directory. `CROSSVILLE_DB` selects another local database for isolated testing.

The preview binds only to `127.0.0.1`, validates Host/Origin, and requires a page-bound token for writes. That is local browser protection, not a substitute for production identity and membership checks. Do not expose this single-user preview on a public interface.

## References

- [Existing team setup guide](https://github.com/whale021140/crossville-context/blob/weekly/2026-11-02/docs/TEAM_CONNECTOR_SETUP.md)
- [Existing maintained handoff](https://github.com/whale021140/crossville-context/blob/weekly/2026-11-02/docs/CONTEXT_HANDOFF.md)
- [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp)
- [Official MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)

## Hosted build

`npm run build` bundles the existing UI and context service into `dist/server/index.js`. `.openai/hosting.json` identifies this Site and declares the DB binding; `drizzle/` contains the schema-only migration. Sites applies the migration during publication. Generated builds, local databases, verification logs, caches and credentials are excluded from Git. No GitHub Actions deployment or GitHub-to-Sites automatic deployment is configured.
