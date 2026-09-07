# Contributing

SecureVault is a portfolio project, but it is run like a product codebase.

## Ground rules

- Fictional documents only. Never commit, screenshot, or attach a real
  passport, ID, lease, or receipt; the "Republic of Example" passport and the
  sample lease under `docs/images` are the pattern.
- One concern per commit, written as a single-line conventional commit
  without a scope or body, for example `feat: add the zoomable page viewer`.
- Run `npm run validate` before asking for review. It runs Prettier, ESLint,
  strict TypeScript, Jest, and Expo Doctor, the same gate CI runs.
- A change that touches native code, encryption, the session model, or the
  backup format needs a native run on both platforms and a note under
  `docs/verification/`; a change of direction needs an ADR under `docs/adr/`.
- Never block development builds on security checks, and never log, store,
  or transmit a passphrase, PIN, or key.

## Setting up

Follow the run instructions in the [README](README.md). The Jest suites do
not need a simulator; the repository tests use a real SQLite through
better-sqlite3 and the vault module has an in-memory double.

## Project guide

[`CLAUDE.md`](CLAUDE.md) lists the commands, the structure, and the
conventions in more detail.
