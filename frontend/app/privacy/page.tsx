import Link from "next/link";

import { V1Shell } from "@/components/v1/v1-shell";
import { SupportEmail } from "@/components/support-email";
import { LEGAL_LAST_REVISED, LEGAL_SIGNOFF_COMPLETE } from "@/lib/flags";

export const metadata = { title: "Privacy Policy — Citoya" };

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

export default function PrivacyPage() {
  return (
    <V1Shell>
      <div className="section" style={{ maxWidth: 760 }}>
        <div className="sec-tag">Legal</div>
        <h2 className="sec-title" style={{ marginBottom: 6 }}>Privacy Policy</h2>
        <p className="sec-sub" style={{ marginBottom: 20 }}>
          {LEGAL_SIGNOFF_COMPLETE ? `In effect · last revised ${LEGAL_LAST_REVISED}` : `Draft dated: July 16, 2026 · last revised ${LEGAL_LAST_REVISED}`}
        </p>

        {!LEGAL_SIGNOFF_COMPLETE && (
          <div style={draftBanner} role="note">
            <strong style={{ display: "block", fontSize: ".95rem", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".03em" }}>
              Draft: pending legal review and sign-off
            </strong>
            This document is a working draft. It has <strong>not</strong> been reviewed by counsel and is
            <strong> not yet in effect</strong>. Draft dated July 16, 2026, last revised {LEGAL_LAST_REVISED}.
          </div>
        )}

        <div className="legal-body">
          <p>Citoya connects students with community-service opportunities and is <strong>free forever for students</strong>. This policy explains what we collect, why, who can see it, and the choices you have. We collect the minimum needed to run the service, we do not use advertising or third-party analytics, and <strong>we never sell your data</strong>.</p>

          <h3>What we collect</h3>
          <ul>
            <li><strong>Account details.</strong> Students provide a name, email, password, and <strong>date of birth</strong> (used to enforce the minimum age and the guardian-consent and award rules; see below). Organizations provide an organization name and contact email; if an organization is on a paid plan, we also store a billing-processor account reference (a Stripe customer ID) so we know which subscription belongs to which organization.</li>
            <li><strong>Guardian details (minors only).</strong> If you are a student under 18, we collect your parent or guardian&rsquo;s <strong>name and email</strong> so we can request their consent. We also record the date/time, IP address, and browser of a guardian&rsquo;s consent decision as proof of consent.</li>
            <li><strong>Activity.</strong> Opportunities you create or apply to, applications, verified volunteer hours, awards, reviews, endorsements, saved opportunities, in-app notifications, and messages you send through the platform.</li>
            <li><strong>Approximate location (optional).</strong> If you enter a ZIP code or choose &ldquo;use my location,&rdquo; we use it to estimate distances to opportunities. Precise device coordinates are rounded in your browser and are <strong>not stored</strong>.</li>
            <li><strong>Aggregate usage counts.</strong> We count how many times each part of the site is used per day &mdash; for example &ldquo;the opportunity page was opened 40 times today.&rdquo; These counts are <strong>totals only</strong>: they record no account, no IP address, no device or session identifier, and no time more precise than the day, so they cannot show what any individual person looked at. We use them to see which features are worth keeping and where the service is breaking. An organization can also see totals for <em>its own</em> listings &mdash; how many times a listing was opened, how many people it approved, and hours it verified &mdash; on the same terms: totals only, with no record of who looked.</li>
            <li><strong>What we do <em>not</em> collect.</strong> No advertising or tracking identifiers, <strong>no third-party analytics</strong> (the counts above are our own, and no data about your visit is sent to any analytics company), and <strong>no cookies of our own</strong> &mdash; Citoya itself sets none. The bot-check on the sign-up and password-reset forms is run by Cloudflare, whose script may set its own cookie in your browser to remember that the challenge was solved; that is Cloudflare&rsquo;s, not ours, and we do not read it. Payment card details for organization subscriptions are handled by our payment processor (Stripe) and never touch our servers.</li>
          </ul>

          <h3>Sign-in mechanism (no cookies)</h3>
          <p>Citoya does <strong>not</strong> use cookies to sign you in or to track you (see the Cloudflare bot-check note above for the one cookie we do not control). When you log in, your browser stores a sign-in token in <code>localStorage</code>, which is sent with your requests to keep you logged in; a small number of interface preferences may also be stored there. Nothing in <code>localStorage</code> is used for tracking or advertising. You can clear it any time by logging out or clearing your browser&rsquo;s site data.</p>

          <h3>Why we use it</h3>
          <ul>
            <li><strong>Run your account</strong>: authenticate you (sign-in token), and let you manage your profile.</li>
            <li><strong>Match &amp; apply</strong>: show relevant opportunities and let you apply; the date of birth drives age-based award tracking and the consent gate.</li>
            <li><strong>Verify service</strong>: record hours and let organizations verify them, and recognize awards for verified hours.</li>
            <li><strong>Communicate</strong>: send in-app notifications, guardian-consent requests, and transactional emails (see Email, below).</li>
            <li><strong>Keep it safe</strong>: bot protection, rate limiting, and an append-only audit log of security-relevant actions (logins, consent decisions, deletions), kept for 12 months.</li>
          </ul>

          <h3>Who sees what</h3>
          <ul>
            <li><strong>Organizations you apply to</strong> see the details relevant to your application (including your name and email) only <strong>after you apply</strong> to one of their opportunities. This is scoped to that organization.</li>
            <li><strong>Public surfaces minimize minor names.</strong> The public leaderboard, any public service portfolio, and reviews shown on an organization&rsquo;s page all show a minor&rsquo;s name as <strong>first name and last initial only</strong> &mdash; never a full last name.</li>
            <li><strong>Your service portfolio is private by default</strong> and public only if you opt in; for a student under 18, making it public requires verified guardian consent. A private or unknown portfolio link returns a generic &ldquo;not found&rdquo; and never reveals whether an account exists.</li>
            <li><strong>Service providers.</strong> We share data with vendors only as needed to run the service, for example, email delivery (Resend), payment processing for organization subscriptions (Stripe), error monitoring (Sentry, which receives technical error reports scrubbed of your personal information &mdash; no name, email, IP address, or form contents), and bot-defense on sign-up (Cloudflare Turnstile, which receives your IP address and a solved-challenge token, not your account details), under confidentiality obligations. We never sell or rent personal data.</li>
          </ul>

          <h3>Guardian rights</h3>
          <p>When a student under 18 signs up, we email the listed guardian a link to <strong>approve or decline</strong> the account. If approved, the guardian receives a separate long-lived link that lets them <strong>revoke consent at any time</strong>; revoking immediately re-blocks the student from applying, messaging, checking in, submitting or appealing hours, leaving a review, or making a portfolio public. <strong>Revoking also reaches back over what is already public</strong>, not just what happens next: any still-active application is withdrawn and its spot released to the next student waiting, and the student&rsquo;s name and any reviews they wrote stop appearing on public pages &mdash; including the review count and average rating shown on an organization&rsquo;s page, which are recalculated without them. An organization keeps its own record of hours it already verified, shown as a deactivated participant without saying why. Guardians who have questions or want a student&rsquo;s data removed can contact us at <SupportEmail />. A deletion made by a guardian takes effect immediately and cannot be undone by the student.</p>

          <h3>Your rights &amp; choices</h3>
          <ul>
            <li><strong>Access &amp; export.</strong> Download a JSON copy of your data (profile, applications, hours, messages, reviews, and notifications) from the <strong>Account</strong> section of your dashboard (&ldquo;Download my data&rdquo;). The export excludes internal security fields such as your password hash and consent-decision IP.</li>
            <li><strong>Correct.</strong> Update your details any time in your account.</li>
            <li><strong>Delete.</strong> Delete your account from the <strong>Account</strong> section of your dashboard (password required). Your account is deactivated immediately, and your personal data is permanently removed <strong>48 hours later</strong>; logging in before then restores the account (any signups released when you deleted it are not restored). <strong>Honest caveat:</strong> so that an organization&rsquo;s record of already-verified service survives, your applications and verified-hours history are <strong>kept in anonymized form with your name and identifying details removed</strong> &mdash; including any note, supervisor name, or appeal text attached to those hours &mdash; and entries in the append-only security audit log are retained for up to <strong>12 months</strong> from the date of the event. Messages you sent are handled the same way: the entry stays in the conversation so the other person&rsquo;s thread has no gaps, but the text you wrote is removed along with your name. Organizations must deactivate active listings before deleting.</li>
          </ul>

          <h3>Email</h3>
          <p>We send <strong>transactional email only</strong>: things like application updates, hour verifications, guardian-consent requests, and password resets. There is no marketing email. You can turn off non-essential notification emails with the email-notifications toggle on the Notifications page; security and consent-critical messages may still be sent.</p>

          <h3>Data retention &amp; security</h3>
          <p>We keep your data while your account is active and remove personal data 48 hours after you delete your account (logging in before then restores it), subject to the anonymized-service-record caveat above. The <strong>security audit log</strong> — the record of logins, consent decisions, password resets and deletions — is kept for <strong>12 months</strong> and then deleted by age; entries are never removed individually, because a log anyone can edit is not a record. Passwords are stored using a strong one-way hash (Argon2), never in plain text, and traffic is encrypted in transit (HTTPS). No system is perfectly secure, but we follow industry practices to protect your information.</p>

          <h3>Children&rsquo;s privacy</h3>
          <p>Citoya is used by students who may be minors, and we build for that. Students under <strong>13</strong> are not permitted to register. Students aged 13&ndash;17 may create an account, but a <strong>parent or guardian must verify consent before the student takes any real-world-contact action</strong>: applying, messaging, checking in, submitting or appealing hours, leaving a review, or making a portfolio public. We collect only what&rsquo;s needed for volunteer matching and hour tracking, and we minimize minors&rsquo; names on all public surfaces. If you believe a child under our minimum age has provided information, or a minor is using the service without appropriate guardian consent, contact us at <SupportEmail /> and we will address it.</p>

          <h3>Your regional rights (CCPA / GDPR)</h3>
          <p>Depending on where you live, you may have rights to <strong>access</strong> the personal data we hold about you, request its <strong>deletion</strong>, and obtain a <strong>portable copy</strong>. Citoya supports all three directly: access and portability through the data export, and deletion through account deletion, both in your dashboard&rsquo;s Account section. We do not sell personal information or use it for targeted advertising. To exercise a right you can&rsquo;t complete in-app, or to ask a question, contact us at <SupportEmail />.</p>

          <h3>Changes &amp; contact</h3>
          <p>We may update this policy; material changes will be reflected by the date at the top. Questions or requests: <SupportEmail />. See also our <Link href="/terms">Terms of Service</Link>.</p>
        </div>
      </div>
    </V1Shell>
  );
}
