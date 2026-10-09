# Citoya — engineering process & frontend (public mirror)

Citoya connects student volunteers with community-service opportunities —
free forever for students. This repo is the **public mirror** of the v2 build:
the engineering-process documentation plus the frontend source. The full
application (FastAPI/Postgres backend) lives in a **private** repo. The security
bin's FILE is withheld; its one-line INVARIANTS ship deliberately in
`.claude/project-memory/INDEX.md`. The other bins, the published ADR and the
build log do describe how features work, security features included, and they
narrate security bugs that were found and fixed.

## What's here

| Path | What it is |
|---|---|
| `docs/record_2026-07-07.md` | The v2 build log, 2026-07-07 to 2026-07-16: per-task WHAT/WHY/HOW entries, honest about failures and abandoned approaches |
| `docs/record_2026-07-16.md` | The build log, continued: 2026-07-16 to 2026-08-31 (each file is named for its first day). Five security-audit entries in that span are withheld, each marked where it was |
| `docs/research/` | Sourced research briefs that fed design decisions |
| `docs/adr/` | Architecture decision records |
| `.claude/project-memory/` | Binned technical memory (architecture, conventions, features, gotchas) — the private tree's other bins, `security.md` among them, are intentionally omitted |
| `frontend/` | The Next.js 16 / React 19 / TypeScript frontend — served to every browser anyway, so public by definition |

The published record stops at 2026-08-31. Later work, such as 48-hour recoverable
deletion, off-site hours, the private calendar feed and the dashboard rewrite, is
summarised in the bins and visible in `frontend/`. Its record entries stay in the
private repo until someone reviews them for publication.

## Why the process is documented like this

The point of this project isn't just a working app — it's a demonstrable
engineering process: an append-only record where mistakes stay visible, dated
decisions, verification pasted rather than claimed, and docs a fresh
collaborator (or a cheaper model) can execute from without the author filling
gaps from memory.

*The build logs mention env-variable names (e.g. `STRIPE_SECRET_KEY`), never
values. Every sync into this repo is scanned for secret-shaped strings and stops
on a hit. The commit-time scanner only runs on the author's own clone:
`scripts/git-hooks/pre-commit` calls a scanner that is not part of this repo, so
on any other clone it prints a warning and lets the commit through.*
