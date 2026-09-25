/**
 * The one place the support address lives.
 *
 * BLOCKED-ON-EVAN: `NEXT_PUBLIC_SUPPORT_EMAIL` is unset until Evan provides a real
 * address, and it is never guessed. Until then the legal pages render an explicit
 * placeholder instead of a fake mailto — the value was previously hardcoded as
 * "[CONTACT EMAIL — Evan]" in seven separate places, which would have shipped that
 * literal string to real users (audit 2026-08-05).
 *
 * NEXT_PUBLIC_* is baked in at BUILD time, so a change needs a rebuild, not just a
 * restart (see the compose build-args comment).
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";

/** True once a real address is configured. */
export const HAS_SUPPORT_EMAIL = SUPPORT_EMAIL.length > 0;

/** Display text for the contact address. */
export const SUPPORT_LABEL = HAS_SUPPORT_EMAIL ? SUPPORT_EMAIL : "[CONTACT EMAIL — Evan]";

/** `mailto:` target, or null when nothing is configured (render plain text instead). */
export const SUPPORT_MAILTO = HAS_SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : null;
