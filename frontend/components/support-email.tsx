import { SUPPORT_LABEL, SUPPORT_MAILTO } from "@/lib/support";

/**
 * Renders the support contact. A real address becomes a mailto link; while
 * `NEXT_PUBLIC_SUPPORT_EMAIL` is unset (BLOCKED-ON-EVAN) it renders the
 * placeholder as plain text rather than a mailto that goes nowhere.
 */
export function SupportEmail() {
  if (!SUPPORT_MAILTO) return <span>{SUPPORT_LABEL}</span>;
  return <a href={SUPPORT_MAILTO}>{SUPPORT_LABEL}</a>;
}
