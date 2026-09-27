import Link from "next/link";

import { V1Shell } from "@/components/v1/v1-shell";
import { SupportEmail } from "@/components/support-email";
import { LEGAL_LAST_REVISED, LEGAL_SIGNOFF_COMPLETE } from "@/lib/flags";

export const metadata = { title: "Terms of Service — Citoya" };

const draftBanner = {
  background: "var(--gold-pale)",
  border: "2px solid var(--gold)",
  borderRadius: 8,
  padding: "14px 18px",
  marginBottom: 28,
  color: "var(--dark)",
  fontSize: ".9rem",
  lineHeight: 1.6,
} as const;

// Same gold treatment as the draft banner: an unanswered clause should look
// unanswered, not like ordinary body copy a reader skims past.
const openClause = {
  background: "var(--gold-pale)",
  border: "1px solid var(--gold)",
  borderRadius: 6,
  padding: "10px 14px",
} as const;

// The two values a legal reviewer must supply (M11 Phase 1). BLOCKED-ON-EVAN:
// they are a liability decision about who operates a service holding minors'
// data, so they are never guessed here — null means "not yet answered".
//
// WHY THEY ARE CONSTANTS AND NOT ANOTHER NEXT_PUBLIC_ FLAG (2026-09-15, Appendix F
// MEDIUM). A new `NEXT_PUBLIC_*` var must also be declared as an ARG/ENV in
// `frontend/Dockerfile` or the build silently inlines an empty string — that is
// exactly the defect found on 2026-09-07, where `NEXT_PUBLIC_LEGAL_SIGNOFF_COMPLETE`
// had no ARG and so could never clear the draft banner in a container. Two literals
// edited in place cannot fail that way.
const GOVERNING_STATE: string | null = null;
const LEGAL_ENTITY_NAME: string | null = null;

// `LEGAL_SIGNOFF_COMPLETE` is a boolean and a boolean cannot see a bracket, so on
// its own it let the page print "In effect" above a governing-law clause that still
// named a bracket. Effect now requires BOTH: counsel signed off, and the
// values they were signing off ON are actually present. `backend/tests/
// test_legal_pages_are_publishable.py` enforces the same rule from the other side;
// this makes the page itself incapable of the claim rather than relying on a test
// that only fires when someone sets the env var during a CI run.
const LEGAL_VALUES_FILLED = GOVERNING_STATE !== null && LEGAL_ENTITY_NAME !== null;
const IN_EFFECT = LEGAL_SIGNOFF_COMPLETE && LEGAL_VALUES_FILLED;
export default function TermsPage() {
  return (
    <V1Shell>
      <div className="section" style={{ maxWidth: 760 }}>
        <div className="sec-tag">Legal</div>
        <h2 className="sec-title" style={{ marginBottom: 6 }}>Terms of Service</h2>
        <p className="sec-sub" style={{ marginBottom: 20 }}>
          {IN_EFFECT ? `In effect · last revised ${LEGAL_LAST_REVISED}` : `Draft dated: July 16, 2026 · last revised ${LEGAL_LAST_REVISED}`}
        </p>

        {!IN_EFFECT && (
          <div style={draftBanner} role="note">
            <strong style={{ display: "block", fontSize: ".95rem", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".03em" }}>
              Draft: pending legal review and sign-off
            </strong>
            This document is a working draft. It has <strong>not</strong> been reviewed by counsel and is
            <strong> not yet in effect</strong>. It does not create binding obligations until published in
            final form. Draft dated July 16, 2026, last revised {LEGAL_LAST_REVISED}.
          </div>
        )}

        <div className="legal-body">
          <p>Welcome to Citoya. Citoya is a platform that connects students with community-service and volunteer opportunities: students discover opportunities, apply, log hours that the hosting organization verifies, and earn awards for verified service; organizations post opportunities, review applicants, and verify attendance. Citoya is <strong>free forever for students</strong>: no feature that a student uses is ever gated behind a payment. By creating an account or using the platform you agree to these Terms. If you don&rsquo;t agree, please don&rsquo;t use the service.</p>

          <h3>Accounts &amp; eligibility</h3>
          <ul>
            <li><strong>Minimum age.</strong> You must be at least <strong>13 years old</strong> to create a student account. Registration is blocked below that age, and every student account requires a date of birth, which we use to compute age for the consent and award rules below.</li>
            <li><strong>Minors and guardian consent.</strong> If you are a student <strong>under 18</strong>, you must provide a parent or guardian&rsquo;s name and email at sign-up, and that guardian must approve your account before you can take any real-world-contact action: applying to an opportunity, messaging, checking in, submitting or appealing hours, leaving a review, or making your service portfolio public. Until a guardian verifies consent (and if a guardian later revokes it), those actions are blocked. A student who turns 18 is no longer gated.</li>
            <li><strong>Organizations.</strong> Organization accounts must represent a legitimate group and provide accurate details. <strong>A new organization&apos;s listings stay hidden until we approve the organization, and we can withdraw that approval.</strong> Approval is a review, not a background check. Anyone can create an organization account and post an opportunity. Before attending anything in person, students and guardians should confirm independently that an organization is who it says it is.</li>
            <li><strong>Account security.</strong> You are responsible for keeping your password secure and for activity under your account. Provide accurate information and keep it current. One person or organization per account; don&rsquo;t impersonate others.</li>
          </ul>

          <h3>Acceptable use</h3>
          <p>To keep Citoya safe and trustworthy, you agree not to:</p>
          <ul>
            <li>Log, claim, or verify volunteer hours that weren&rsquo;t actually performed.</li>
            <li>Post false, misleading, unsafe, or illegal listings or content.</li>
            <li>Harass, abuse, or endanger other users; collect others&rsquo; data; or contact users for purposes unrelated to volunteering.</li>
            <li>Scrape, overload, probe, or attempt to break the security of the service, or circumvent the bot protection, rate limits, or consent gates.</li>
          </ul>

          <h3>Volunteer hours &amp; awards</h3>
          <p>Hours are submitted by students and <strong>verified by the hosting organization</strong>; awards are based on verified hours. Citoya provides the tools but does not independently guarantee the accuracy of hours or the conduct of any organization or volunteer. Verify details directly and use your judgment about safety before attending an in-person activity. Organizations are responsible for the accuracy of their listings, for honoring posted commitments, for verifying hours fairly, and for complying with applicable laws, including any background-check or supervision requirements for working with minors.</p>

          <h3>Your content &amp; intellectual property</h3>
          <p>You keep ownership of the content you submit: your profile, listings, reviews, endorsements, and messages. By submitting content you grant Citoya a non-exclusive, worldwide, royalty-free license to host, store, reproduce, and display that content <strong>solely to operate and provide the service</strong> (for example, showing your review on an organization&rsquo;s page or your name on the public leaderboard). This license ends when you delete the content or your account, except for content already shared with others or retained in anonymized form as described in the Privacy Policy, and except as needed for backups, legal compliance, or an organization&rsquo;s record of verified service. <strong>For a student under 18, a guardian revoking consent also ends the public display</strong> of that student&rsquo;s name and reviews, without the student deleting anything. Citoya&rsquo;s own name, logo, and software remain ours. We may remove content that violates these Terms.</p>

          <h3>Copyright &amp; other IP complaints</h3>
          <p>We respect intellectual-property rights and expect users to do the same. If you believe content on Citoya infringes your copyright or other IP rights, send a notice to <SupportEmail /> that includes: (1) your contact information; (2) identification of the work you claim is infringed; (3) identification of the material you want removed and where it appears on the service; (4) a statement that you have a good-faith belief the use is not authorized; and (5) a statement, under penalty of perjury, that the notice is accurate and that you are the rights-holder or authorized to act for them. We will review and remove or disable access to infringing material in appropriate cases, and we may terminate the accounts of repeat infringers. If your content was removed and you believe that was a mistake, you may send a counter-notice to the same address.</p>

          <h3>Organization subscriptions &amp; billing</h3>
          <p><strong>Students never pay.</strong> Paid plans apply only to organizations. Organizations may use Citoya on the free Community plan or subscribe to a paid <strong>Pro</strong> plan; current plan features and prices are listed on the <Link href="/pricing">Pricing</Link> page. Pro is billed as a recurring <strong>monthly</strong> subscription through our payment processor, Stripe, and renews automatically each month until cancelled.</p>
          <ul>
            <li><strong>Fulfillment.</strong> Pro features (such as unlimited and featured listings) activate <strong>immediately upon successful payment</strong> and remain available for the paid billing period.</li>
            <li><strong>Cancellation &amp; refunds.</strong> You can cancel Pro at any time. Cancellation takes effect at the <strong>end of the current billing period</strong>: your Pro features remain active until then, and your subscription does not renew for the next period. Payments already made for the current or past periods are <strong>non-refundable</strong>, and we do not provide prorated or partial refunds, except where required by law.</li>
            <li><strong>Price &amp; tax changes.</strong> We may change subscription prices or features prospectively; we&rsquo;ll give notice before a change affects your next renewal. You are responsible for any applicable taxes.</li>
          </ul>

          <h3 style={{ textTransform: "uppercase" }}>Warranty disclaimer</h3>
          <p style={{ textTransform: "uppercase" }}>THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. CITOYA DOES NOT VET EVERY ORGANIZATION, OPPORTUNITY, OR USER, DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, AND IS NOT RESPONSIBLE FOR INTERACTIONS THAT OCCUR OFFLINE. YOU USE THE SERVICE AT YOUR OWN RISK.</p>

          <h3 style={{ textTransform: "uppercase" }}>Limitation of liability</h3>
          <p style={{ textTransform: "uppercase" }}>TO THE MAXIMUM EXTENT PERMITTED BY LAW, CITOYA AND ITS OPERATORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, GOODWILL, OR OPPORTUNITIES, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. TO THE MAXIMUM EXTENT PERMITTED BY LAW, CITOYA&rsquo;S TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE TOTAL AMOUNT YOU PAID TO CITOYA IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS. BECAUSE THE SERVICE IS FREE FOR STUDENTS, A STUDENT&rsquo;S FEES-PAID CAP IS ZERO. SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO SOME OF THE ABOVE MAY NOT APPLY TO YOU.</p>

          <h3>Suspension &amp; termination</h3>
          <p>We may suspend or remove accounts that violate these Terms or put others at risk. You can delete your account at any time from the <strong>Account</strong> section of your dashboard; deletion is handled as described in the <Link href="/privacy">Privacy Policy</Link> (the account is deactivated at once and its personal data removed 48 hours later unless you log back in first, while an organization&rsquo;s record of already-verified hours is retained in anonymized form). Organizations must deactivate their active listings before deleting their account.</p>

          <h3>Changes to these Terms</h3>
          <p>We may update these Terms. Material changes will be reflected by the date at the top, and (once the service is live) meaningful changes will be communicated to account holders. Continued use after an update means you accept the updated Terms.</p>

          <h3>Governing law</h3>
          {LEGAL_VALUES_FILLED ? (
            <p>These Terms are governed by the laws of the State of {GOVERNING_STATE}, without regard to its conflict-of-laws rules, and you agree to the exclusive jurisdiction of the state and federal courts located there for any dispute that isn&rsquo;t subject to another agreed process. Citoya is operated by {LEGAL_ENTITY_NAME}.</p>
          ) : (
            <p style={openClause} role="note">
              <strong>Not yet settled.</strong> The governing state and the legal entity that operates
              Citoya are still with a legal reviewer, so this clause is deliberately blank rather
              than filled with a guess: [GOVERNING STATE — Evan] and [LEGAL ENTITY NAME — Evan]. Until
              they are answered these Terms remain a draft and are not in effect.
            </p>
          )}

          <h3>Contact</h3>
          <p>Questions about these Terms: <SupportEmail />. See also our <Link href="/privacy">Privacy Policy</Link>.</p>
        </div>
      </div>
    </V1Shell>
  );
}
