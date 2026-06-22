# Radulator local development launcher

`scripts/dev-local.sh` is the standard app-driving entry point for local QA, bridge verification, and independent feature proof capture.

## Commands

```bash
scripts/dev-local.sh up              # start Vite dev server in tmux on 127.0.0.1:5173
scripts/dev-local.sh preview          # build then start Vite preview on 127.0.0.1:4173
scripts/dev-local.sh status           # show tmux windows + port checks
scripts/dev-local.sh logs dev         # last ~400 lines from the dev window
scripts/dev-local.sh restart dev      # restart one window
scripts/dev-local.sh attach           # attach to tmux session
scripts/dev-local.sh down             # stop the tmux session
```

Optional ports:

```bash
RADULATOR_DEV_PORT=5174 scripts/dev-local.sh up
RADULATOR_PREVIEW_PORT=4174 scripts/dev-local.sh preview
```

## Rules

- Run `npm ci` first if `node_modules/` is missing.
- Keep dev/preview bound to `127.0.0.1` for local agent/browser QA.
- Do not put credentials in this script; it only runs the public Vite app.
- For PR proof, start the app here, then use `scripts/capture-feature-proof.mjs` or a fresh verifier agent per `docs/development/feature-verification.md`.
