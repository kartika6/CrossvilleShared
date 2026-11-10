# Connecting the real Crossville team workspace

This prototype uses the existing Crossville documentation as its integration target. It has not copied or modified the private repository and has not inferred an API from the site's URL. The earlier `docs/API_CONTRACT.md` contains proposed routes; those routes must be checked against the actual current service.

## What to ask the shared-project implementer for

1. One test project ID and the canonical current-context response shape.
2. The supported authentication mechanism for a connector acting as an individual member.
3. Backend operations for reading approved context, submitting a new/replacement proposal, and reading version changes.
4. Server-side membership, reviewer-role and version enforcement, including typed stale/forbidden errors.
5. A synthetic project and two actual member accounts for integration verification.

Signing in to the Site and configuring an MCP client are separate steps. Do not forward someone else's browser cookies, Codex credentials or copied site-session tokens. The backend owner must provide an approved member-scoped connection.

## Canonical context fields to map

```js
{
  project: { id, name, version },
  items: [{
    id, kind, title, text, status, revision,
    claimKey, strength, tags,
    source: { label, author, type }
  }]
}
```

Return only data the authenticated member may access. The production service must filter private, pending, superseded and unresolved-conflict records according to the real project's rules before preparing an effective packet. Source metadata itself may be private; a link does not grant source access.

## Operation boundaries

| Prototype operation | Required live behavior |
| --- | --- |
| `prepareHandoff` | Read authorized latest context and prepare a task-specific immutable packet; include explicit context version and selected item revisions |
| `confirmHandoff` | Check the current backend version and applicable constraints; permit only reviewed personal edits; leave shared records unchanged |
| `prepareProposal` | Keep candidate material private to its author; identify optional explicit replacement targets and base version |
| `submitProposal` | Use the existing authenticated team-proposal service; accept a stable operation ID for duplicate prevention; never approve implicitly |
| `reviewProposal` | Use the existing real review UI and authenticated reviewer; atomically validate the base and update context/history/version |

The local `LocalStore.transaction()` is synchronous SQLite state management. A network backend cannot simply be passed in as that store. Add an asynchronous service adapter at the web/MCP boundary and map each operation into the existing collaboration service. Reuse its authorization and concurrency logic instead of transferring the complete shared database to every connector.

Keep the fictional local adapter as a test mode. Live mode must explicitly identify its project, user and backend, and fail closed when the backend is unavailable; it must not silently fall back to fictional data.

## First live acceptance scenario

Member A retrieves the same approved project version as member B, submits an explicitly reviewed synthetic replacement, and the real reviewer approves it. Both members' subsequent Codex calls return the newer approved version. A's unrelated source conversation and private drafts remain inaccessible to B. Repeating a submission does not create a duplicate. An obsolete preview requires review again.

This proves authenticated access and a direct pull-based return into the requesting chat. Automatic push into idle or running chats, ordinary ChatGPT project-history access and semantic candidate extraction remain separate integration milestones.
