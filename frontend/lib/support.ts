/**
 * The one place the support address lives.
 *
 * Decided 2026-10-11 (record FD): support@citoya.com is the default.
 * `NEXT_PUBLIC_SUPPORT_EMAIL` overrides it at build time.
 *
 * NEXT_PUBLIC_* is baked in at BUILD time, so a change needs a rebuild, not just a
 * restart (see the compose build-args comment).
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@citoya.com";

/** True once a real address is configured (always true now that there is a default). */
export const HAS_SUPPORT_EMAIL = SUPPORT_EMAIL.length > 0;

/** Display text for the contact address. */
export const SUPPORT_LABEL = SUPPORT_EMAIL;

/** `mailto:` target, or null when nothing is configured (render plain text instead). */
export const SUPPORT_MAILTO = HAS_SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : null;
