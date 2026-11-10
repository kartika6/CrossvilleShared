# CrossvilleShared

A working team prototype for **personal LLM chat → connector → reviewed project context → the same chat**. The hosted website and MCP endpoint use one Cloudflare D1 database. Codex or ChatGPT supplies the model; this site does not generate or simulate an LLM answer.

- [Private hosted prototype](https://crossvilleshared.kartika-pinjarkar48.chatgpt.site)
- [Collaboration branch](https://github.com/kartika6/CrossvilleShared/tree/feature/team-collaboration)

## Start the pilot

1. Open the private Site using its owner account. Create a project with a goal, or choose **Create a Crossville sample** to use clearly labeled fictional Crossville data.
2. Open **Team & access**. Create an invitation using the teammate’s exact ChatGPT sign-in email and choose Contributor, Reviewer or Viewer. No email is sent; copy the invitation link yourself.
3. Grant that email access in the **Site’s Share settings**. This is a separate platform gate; a project invitation cannot bypass it. The Site’s audience is preserved on publication. No colleagues have been added automatically.
4. The teammate opens the link, signs in with the invited account and accepts. They now see the same project and context versions.
5. For LLM access, install/connect the personal **CrossvilleShared plugin created by Sites**. Each teammate needs plugin access, Site access and project membership. The owner may need to share the personal plugin separately through its platform controls. A raw MCP URL does not grant access.

The owner Site account is `kartika.pinjarkar48@gmail.com`. If another signed-in account gets an access page, switch to the owner account or explicitly grant that account Site access. Application roles do not override the platform’s access gate.

Teammate email addresses can be supplied later. The joining and role controls are implemented without inviting real people during development.

## Use the connector

The hosted MCP endpoint is `https://crossvilleshared.kartika-pinjarkar48.chatgpt.site/mcp`. Use the Sites-created plugin for authenticated access; no local Node process or global Codex MCP configuration is needed for this hosted path.

Try in a chat with the plugin connected:

> Use CrossvilleShared list_projects. Get the latest get_team_context for my project ID and the task “Plan our pilot schedule”, in auto mode. Answer using the approved context and state its version.

For an editable preview:

> Get CrossvilleShared context in preview mode. Show the selected items and sources, and wait for my explicit edits or confirmation before calling confirm_handoff or answering from the packet.

The tools return context directly to the calling LLM. Copying or downloading is an optional fallback. Tool instructions guide the host, but cannot force a retrieval before every answer. Open or cold chats catch up on their next retrieval; there is no background push into every conversation. The browser’s Refresh button loads the latest context without calling a model.

| Tool | Behavior |
| --- | --- |
| `list_projects` | Lists only the signed-in caller’s projects and roles (hosted only) |
| `get_team_context` | Retrieves approved context by task keywords plus the required brief/constraints; auto return or editable preview |
| `confirm_handoff` | Finalizes the caller’s preview with permitted personal edits and a personal task note |
| `cancel_handoff` | Cancels the caller’s open preview |
| `list_team_context` | Lists approved records and shared proposals for choosing a replacement target |
| `prepare_proposal` | Creates an attributed private draft with an optional explicit replacement target |
| `submit_proposal` | Submits the exact draft after human confirmation; repeated submission returns the same proposal |

Every hosted context tool accepts `project_id`. It is required when the caller belongs to more than one project. Approval remains a separate human action in the website’s Review inbox.

## Roles and precedence

| Role | Read / retrieve | Propose | Review | Manage team |
| --- | --- | --- | --- | --- |
| Viewer | Yes | No | No | No |
| Contributor (`editor`) | Yes | Yes | No | No |
| Reviewer | Yes | Yes | Yes | No |
| Owner | Yes | Yes | Yes | Yes |

At least one owner must remain. Membership and roles come from the backend, never an editable browser field. Invitations expire after seven days and are bound to the verified email, not just possession of the URL. Removing a member blocks further project access and invalidates their unused invitations.

Approved context is effective. Pending proposals cannot override it. An explicit reviewed replacement supersedes the targeted item and advances the shared version. Required brief/constraints remain included and cannot be rewritten in a personal preview. Optional packet edits stay personal. This is a simple inspectable precedence model; semantic conflict detection is not connected.

## Database setup

Sites provisions D1 from `.openai/hosting.json` (`d1: DB`) and applies append-only SQL migrations in `drizzle/` during publication. No database credentials are embedded in the browser or repository.

| Table | Stores |
| --- | --- |
| `cv_projects` | Project identity and membership revision |
| `cv_members` | Project-scoped signed-in users and roles |
| `cv_invitations` | Email-bound invitations, expiry, acceptance and revocation |
| `cv_user_settings` | Active project and per-account browser write token |
| `hosted_workspace` | One versioned JSON document per project: approved items, proposals, snapshots, personal packets, drafts and events |

Private drafts, packet tasks and handoff history are filtered to their creator. Shared proposals become visible on submission. The server checks project membership for all data access and uses compare-and-swap state and access revisions to reject concurrent/stale writes. The JSON-per-project design suits a small pilot; larger-scale use should normalize high-volume event and draft storage.

The earlier hosted fictional row is retained; it is not silently imported into a real project or deleted. New projects start from the owner’s goal. Sample projects are explicitly labeled fictional. This prototype does not read full chat histories or connect to Leyi’s separate Crossville deployment.

## Local development

Requires Node.js 24 or later.

```sh
npm install
npm run preview:team
```

Open http://127.0.0.1:4318. This runs the built Worker with a local SQLite D1 adapter and **fictional test identities**. The top QA bar switches between an owner, colleague and professor. Use `colleague@example.test` or `professor@example.test` for local invitation tests. No messages are sent and no hosted data is accessed. Data stays in ignored `.data/team-preview.sqlite`. The QA identity switch lives only in this loopback development script; it is never bundled into the published Worker.

The original single-user local demo is still available with `npm start` at http://127.0.0.1:4317. Its local STDIO MCP server (`npm run mcp`) shares `.data/workspace.sqlite` with that demo. **Those local stores are separate from hosted D1.** The hosted team connection uses the personal plugin instead.

Local STDIO setup, if deliberately testing that separate demo:

```sh
codex mcp add crossville_shared -- node "$(pwd)/src/mcp-server.js"
```

This example registers a persistent local connection if you run it. Development has not changed your global MCP configuration.

## Verification

```sh
npm test
npm run check
```

Tests use disposable databases. They cover real MCP STDIO and HTTP clients, authenticated hosted routes, project isolation, invitation email matching/expiry/revocation, role enforcement, private draft/packet ownership, last-owner protection, stale context and concurrent access changes, and website proposal → reviewer approval → MCP retrieval from the same database.

Browser QA exercised separate fictional accounts joining and proposing, owner review advancing v2 → v3, and desktop/mobile layout. Real colleague onboarding and their personal plugin access remain to be checked after the owner supplies their emails. The local browser’s current signed-in account may differ from the Site owner; this does not justify widening access automatically.

An actual Codex model call was previously verified against the isolated local STDIO demo, not the hosted team project. `node scripts/verify-codex.js` repeats that check using Codex allowance and disposable fictional data. No additional model calls are required for ordinary UI changes.

## Structure

```text
worker/index.js          Sites identity, browser routes and shared dispatch
worker/collaboration.js  D1 projects, membership, invitations, access checks
worker/mcp.js            Stateless hosted MCP discovery and tool calls
src/service.js           Handoff, proposal and review rules
src/domain.js            Selection, version changes and packet formatting
src/tools.js             Shared Zod tool schemas
src/memory-store.js      Hosted unit of work
src/store.js             Original local SQLite demo
src/mcp-server.js        Local STDIO transport
src/web-server.js        Original loopback single-user preview
public/                 Plain HTML, CSS and JavaScript UI
scripts/team-preview.js Local-only multi-account QA harness
scripts/d1-local.js      Test/development SQLite D1 adapter
```

`npm run build` bundles the Worker at `dist/server/index.js`. The Site manifest declares D1 and the `mcp` capability. Sites creates/refreshes the private personal plugin during publication. GitHub stores source; it is not the dynamic backend or an automatic deployment pipeline. No GitHub Actions deployment is configured.

## References

- [Existing Crossville connector guide](https://github.com/whale021140/crossville-context/blob/weekly/2026-11-02/docs/TEAM_CONNECTOR_SETUP.md)
- [Existing Crossville handoff](https://github.com/whale021140/crossville-context/blob/weekly/2026-11-02/docs/CONTEXT_HANDOFF.md)
- [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp)
