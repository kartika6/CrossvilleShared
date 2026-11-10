# CrossvilleShared

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed by Kartika: lightweight Node.js and plain HTML/CSS, implemented in JavaScript now. Keep service, context rules, MCP transport and UI separate for a later TypeScript migration. Node 24 provides the local SQLite store.

## Users

Kartika and a small research team, including colleagues and a professor, work in their individual Codex conversations and need current shared project context.

## Product Purpose

Prototype the loop from a personal LLM to a connector, through reviewed group context, and back to the same conversation. Context can arrive directly, with an optional editable preview. New contributions can become proposals for team review.

## Operating Context

The existing Crossville setup guide and maintained handoff record describe personal connectors, owner-reviewed proposals, shared context versions and experimental delivery into existing chats. The private repository is unavailable to the terminal/GitHub connector in this environment. This is a separate local project using those documented boundaries, rather than a copy of the repository.

## Capabilities and Constraints

- Real local MCP tools return structured, versioned context to the calling Codex conversation.
- The web interface inspects the same local service and provides an editable handoff preview and fictional proposal/review loop.
- The initial workspace is clearly labeled fictional. The owner-private hosted preview uses D1 and the local MCP server uses SQLite. These two test stores are separate; neither connects to the live team site or personal chat history.
- Context selection is deterministic and inspectable. No semantic retrieval or LLM response is simulated as a real model.
- A Codex host supplies the model. The browser preview supplies a prepared context packet, not an invented AI answer.
- Context preview edits apply to that packet; shared changes require a separate proposal and review.
- CrossvilleShared is the confirmed project name. Local testing precedes any external connection.

## Brand Commitments

Keep the established Crossville visual language: a light three-column workspace, quiet blue accents, thin dividers, clear source attribution and simple typography. The existing public prototype is a reference, not a new design world.

## Evidence on Hand

The shared setup guide, handoff history and earlier plan were reviewed in this chat. The public Crossville prototype at https://kartika6.github.io/crossville-unified/ was visually inspected. Live team API access and multi-account verification remain unavailable.

## Product Principles

- The person can see which context crosses a boundary.
- Proposals remain distinguishable from approved shared decisions.
- Versions and delivery status reflect observable events.
- Private exploration can continue independently.
