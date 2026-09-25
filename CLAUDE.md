# citoya-portfolio — generated mirror, do not edit here

This repository is a **one-way public mirror** of a private project. Every file
here is written by `scripts/sync_portfolio.py` in the private tree; the next
sync overwrites whatever you change, so an edit made here is lost work, and a
commit made here is a fork of a generated artifact. Change the private source.

**Publication is an explicit by-name allowlist** — `MANAGED_DIRS`,
`MANAGED_ROOT_FILES`, `PUBLIC_BINS`, `PUBLIC_RESEARCH`, `PUBLIC_ADRS`,
`PUBLIC_RECORDS`. Dropping a file into a published folder does NOT publish it;
adding its name to the list does. Treat that addition as a review step.

**The pre-commit hook here is a SECRET scanner only.** It answers "is there a
credential in this file", never "should this document exist outside the
project". A zero-secret document can still be unpublishable — research notes,
legal analysis, audit findings, anything addressed to a reviewer.

Never include "Co-Authored-By: Claude Opus 5.5 (or any other model) <noreply@anthropic.com>" in any commits or pushes
