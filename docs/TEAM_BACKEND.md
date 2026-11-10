# Hosted team backend

CrossvilleShared now has its own hosted collaborative backend. It does not modify or synchronize Leyi’s separate Crossville site.

## Boundaries

Sites authenticates browser and MCP callers and forwards trusted site-scoped identity headers. CrossvilleShared checks project membership and role on the server. The Site’s sharing gate, the personal plugin’s sharing/installation, and application project membership are separate requirements. Keep the Site’s existing private audience until the owner supplies exact invitees.

`worker/collaboration.js` owns projects, membership, email-bound invitations and active-project settings. It loads a project into the shared ContextService and persists changed state only if both storage and membership revisions still match. The browser and hosted `/mcp` endpoint call this same adapter against the same D1 binding.

Private draft and packet content is returned only to the actor who created it. Submitted proposals are project-shared. Owners/reviewers review on the website. All approved changes preserve attribution and version history; stale previews/proposals cannot silently replace current context.

## First pilot

Create a real project from a goal or explicitly create a fictional Crossville sample. Invite exact sign-in emails and assign contributor/reviewer/viewer roles. Invitations generate a copyable link without sending email. Grant Site and plugin access separately using platform sharing controls. Test one colleague’s join → retrieve → contribute → review → retrieve loop before inviting a larger group.

No real invitations or platform allowlist changes were made during this implementation. Sample accounts are limited to the local QA harness.

## Migration and storage

`0000_workspace.sql` is preserved. `0001_collaboration.sql` adds registry and membership tables; no data is seeded by migrations. Existing legacy demo data is retained. New workspace documents are keyed by a new project UUID. Native Sites publication provisions bindings and applies pending migrations.

D1 stores one JSON document per project for this small pilot. Optimistic revisions reject competing updates instead of losing data. High-volume work would benefit from separate proposal, packet and event tables and retention controls. No full transcript ingestion, Slack ingestion, semantic retrieval or automated conflict resolution is connected.

## MCP protocol

Stateless JSON-RPC POST `/mcp` supports `server/discover`, `tools/list`, `tools/call`, legacy initialization, ping and notifications. Metadata contains no private records and can be discovered without identity. Every tool execution requires the Sites-provided caller identity. Tool results use content blocks, structuredContent and isError. `project_id` is required for callers with multiple projects.

The `mcp` manifest capability asks Sites to create and refresh the personal plugin. Reuse that plugin instead of creating a second OAuth/app stack or asking teammates to run a local Node process. The original STDIO demo remains isolated for development.

## Verification boundary

Disposable SQLite-backed D1 tests simulate the trusted platform identity headers for multiple users. Browser QA uses the same built Worker under a loopback-only harness that injects fictional identities. The published Worker has no identity-switch route or browser-controlled role field.

The real teammate sign-in and plugin sharing experience must be checked when the owner supplies email addresses and those people join. Platform deployment success and schema inspection verify hosting/migration, not teammate onboarding or automatic tool use before every model response.
