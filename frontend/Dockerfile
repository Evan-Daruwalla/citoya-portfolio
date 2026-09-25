# Multi-stage build for the Next.js frontend → small standalone runtime image (M10.1).
# Digest-pinned on all three stages (audit 2026-09-02) — see backend/Dockerfile
# for the refresh command. A floating tag is an unreviewed upstream change.
FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are baked into the client bundle at build time, so each
# must be declared as a build ARG here (Railway passes matching service variables
# as build args; docker-compose passes them under `build.args`). API base URL,
# public site URL (metadataBase/OG + sitemap + robots), and the Turnstile widget
# site key. Defaults keep local/CI builds working when a var is unset.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
# Support contact shown on the legal pages. BLOCKED-ON-EVAN — empty until a real
# address exists, and never guessed; the pages render a visible placeholder.
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
ENV NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL
# The two lib/flags.ts flags (added 2026-09-07). Docker forwards a build arg ONLY
# for a declared ARG, and Next inlines NEXT_PUBLIC_* at build time — so while
# these were undeclared, setting them in Railway and rebuilding (what
# docs/DEPLOY_RAILWAY.md Step 6 instructs) baked in `undefined`, the `=== "true"`
# comparison in flags.ts went false, and the "pending legal review / not yet in
# effect" banner stayed on /terms and /privacy with NO error anywhere. The launch
# step whose whole point is clearing that banner could not clear it.
# Both default to empty = flag OFF, which is the safe state for each.
ARG NEXT_PUBLIC_LEGAL_SIGNOFF_COMPLETE=
ENV NEXT_PUBLIC_LEGAL_SIGNOFF_COMPLETE=$NEXT_PUBLIC_LEGAL_SIGNOFF_COMPLETE
ARG NEXT_PUBLIC_BILLING_LIVE=
ENV NEXT_PUBLIC_BILLING_LIVE=$NEXT_PUBLIC_BILLING_LIVE
# Staging build (2026-09-22): "staging" turns on the banner and robots disallow-all.
# Declared for the same reason as the two flags above — undeclared, Railway's value
# never reaches the build and a staging site ships indexable and unmarked.
ARG NEXT_PUBLIC_ENVIRONMENT=
ENV NEXT_PUBLIC_ENVIRONMENT=$NEXT_PUBLIC_ENVIRONMENT
RUN npm run build

FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS runner
WORKDIR /app
ENV NODE_ENV=production
# `output: "standalone"` bundles the server + only the deps it needs.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# The node images ship an unprivileged `node` user (uid 1000). The standalone
# bundle is read-only at runtime, so no ownership change is needed.
USER node

EXPOSE 3000
CMD ["node", "server.js"]
