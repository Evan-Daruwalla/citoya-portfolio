# Citoya — engineering process & frontend (public mirror)

Citoya connects student volunteers with community-service opportunities —
free forever for students. This repo is the **public mirror** of the v2 build:
the complete engineering-process documentation plus the frontend source. The
full application (FastAPI/Postgres backend) lives in a **private** repo; its
security-relevant internals (auth, guardian-consent mechanics, rate limiting,
billing webhooks, deploy runbook, secret registry) are deliberately not
published for a platform that serves minors. The security bin's FILE is withheld;
its one-line INVARIANTS ship deliberately in `.claude/codebase-memory/INDEX.md`
(the rules a reviewer needs, never the mechanism that implements them).

## What's here

| Path | What it is |
|---|---|
| `docs/record_2026-07-07.md` | The v2 build log: per-task WHAT/WHY/HOW entries, honest about failures and abandoned approaches |
| `docs/record_2026-07-16.md` | The build log, continued — published through the last entry that has been reviewed for publication; later entries stay in the private repo until they are |
| `docs/research/` | Sourced research briefs that fed design decisions |
| `docs/adr/` | Architecture decision records |
| `.claude/codebase-memory/` | Binned technical memory (architecture, conventions, features, gotchas) — the private tree's other bins, `security.md` among them, are intentionally omitted |
| `frontend/` | The Next.js 16 / React 19 / TypeScript frontend — served to every browser anyway, so public by definition |

## Why the process is documented like this

The point of this project isn't just a working app — it's a demonstrable
engineering process: an append-only record where mistakes stay visible, dated
decisions, verification pasted rather than claimed, and docs a fresh
collaborator (or a cheaper model) can execute from without the author filling
gaps from memory.

*The build logs mention env-variable names (e.g. `STRIPE_SECRET_KEY`);
no secret values have ever been committed to either repo — a scanner gates every
commit once `core.hooksPath` is activated in each clone.*
