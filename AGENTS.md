# Working on CrossvilleShared

This is a separate hosted team prototype with isolated local development demos. Read PRODUCT.md, DESIGN.md and README.md before changing behavior or presentation.

- Keep UI, domain/service rules, storage and MCP transport separate. JavaScript is the current confirmed stack; avoid a framework migration without a task that calls for it.
- Do not describe fictional fixtures as real team data, deterministic keyword selection as semantic AI retrieval, or prepared packets as verified model use.
- The browser never fabricates a model answer. A connected Codex host supplies the LLM.
- Preserve required context, private draft ownership, proposal/review separation, source attribution and stale-version checks.
- Keep actual shared-backend authorization on the backend. Never infer member identity from an editable browser field.
- Use isolated in-memory or temporary databases for tests. Do not send proposals to the existing team site during development.
- Run `npm test` and `npm run check` for service/protocol changes. Inspect the browser after UI changes, including a narrow viewport.
- The real-model verification script uses Codex allowance and fictional data. Run it when protocol/model integration changes warrant it; routine UI changes do not require another inference call.
