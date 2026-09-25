# Research Brief — What makes a small web product's UI read as "professional" (2025-26)

**Date:** 2026-07-13 · **For:** Evan + the coding model applying this to `servelocal-v2/frontend`
**Question:** Which concrete, implementable criteria make a small SaaS/community product's UI/UX read
as professional — specifically for ServeLocal v2's hand-rolled editorial CSS (solid fills, tight
radii, calm motion, Fraunces/DM Sans, deep-green palette)?
**Decision it feeds:** the 2026-07-13 UI-polish pass (what to change in `v1.css` + components, in
what order).

## TL;DR

**Verdict: H1 won.** Professional feel in 2025-26 is overwhelmingly attributed to *discipline*, not
decoration: every interactive element having complete, consistent states (hover / active /
focus-visible / disabled), motion that is fast (≤300ms), purposeful, ease-out, and
reduced-motion-aware, and a constrained spacing/type system applied without exception. The rival
hypothesis (heavier visual production — gradients, 3D, scroll effects — drives professionalism) found
no support in practitioner or accessibility literature for *product* UI; those are marketing-page
tropes and, applied to an app, read as template/AI output — the opposite of ServeLocal's editorial
language. ServeLocal v2's biggest gaps against the winning criteria: **zero press feedback** (no
`:active` state anywhere), **no branded `:focus-visible`** (keyboard users get default UA rings on
some elements, nothing consistent), **8 `transition: all` rules**, and an **infinite marquee not
gated by `prefers-reduced-motion`**.

## Method

Desk research, 5 web sweeps (micro-interaction timing, WCAG 2.2 focus appearance, skeletons vs
spinners, reduced-motion, Refactoring-UI-style "amateur tells") + the in-repo `emil-design-eng` skill
as the practitioner baseline. Hypotheses fixed before collection: **H1** discipline-of-states +
calm-fast motion + rhythm = professionalism; **H2 (rival)** heavier visual production; **H0** no
implementable consensus. Limitation: no user testing on ServeLocal itself — perceived-quality claims
are from published research (NN/g) and practitioner consensus, not measured on this product. That
would need a real usability session (human method), not simulated here.

## Findings

### 1. Micro-interactions: the press-feedback + easing consensus
- UI durations: micro-interactions **100–200ms**, standard transitions **200–300ms**, view-level
  **300–500ms**; >500ms reads sluggish. Material fixes 200ms as reference. ([equal.design](https://www.equal.design/blog/5-rules-for-motion-in-ui-transitions), [appypie 200ms rule](https://www.appypie.com/blog/mobile-app-animation-guide), [design.dev CSS transitions](https://design.dev/guides/css-transitions/))
- **Ease-out for anything entering/responding** — starts fast, so the interface feels like it heard
  you; ease-in on UI reads sluggish. (same sources + emil-design-eng skill)
- Buttons need `:active` feedback (`scale(0.95–0.98)`, ~100–160ms) — the canonical "interface is
  listening" signal (emil-design-eng / Sonner practice).
- `transition: all` is a named anti-pattern: transitions must specify exact properties (perf +
  unintended animation). (emil-design-eng; [design.dev](https://design.dev/guides/css-transitions/))

### 2. Keyboard/a11y polish: focus-visible is a professionalism marker
- WCAG 2.4.7 (AA) requires a visible focus indicator; WCAG 2.2's 2.4.13 (AAA) sets the quality bar
  practitioners now treat as default: **≥2 CSS px thick, ≥3:1 contrast** against adjacent colors.
  ([W3C Understanding 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), [W3C 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html))
- Consensus implementation: `:focus-visible` (keyboard-only) with `outline: 2px solid <brand>;
  outline-offset: 2px` — offset lets the ring "breathe"; on dark surfaces flip the outline color to
  keep 3:1. ([Sara Soueidan's guide](https://www.sarasoueidan.com/blog/focus-indicators/), [a11y-collective](https://www.a11y-collective.com/blog/focus-indicator/), [TestParty](https://testparty.ai/blog/wcag-focus-visible-guide))
- `prefers-reduced-motion`: >35% of adults over 40 have experienced vestibular dysfunction; movement
  (marquees, parallax, translate-based hovers) should pause/disable under the media query while
  color/opacity feedback stays. No-motion-first is the strictest current practice. ([web.dev article](https://web.dev/articles/prefers-reduced-motion), [web.dev Learn a11y](https://web.dev/learn/accessibility/motion), [Tatiana Mac](https://www.tatianamac.com/posts/prefers-reduced-motion), [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion))

### 3. Perceived performance
- Waits with feedback feel **11–15% faster**; attention drifts after ~1s of dead time. Skeletons beat
  spinners on perceived speed **only when the wait exceeds ~500ms** — below that, plain space or the
  existing fast spinner is perceptually better (no swap flash). ([NN/g Skeleton Screens 101](https://www.nngroup.com/articles/skeleton-screens/), [NN/g video](https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/), [ResearchGate skeleton study](https://www.researchgate.net/publication/326858669_The_effect_of_skeleton_screens_Users'_perception_of_speed_and_ease_of_navigation))
- A fast spinner (~0.7s/rev — ServeLocal already does this) makes loading feel faster at identical
  load time (emil-design-eng). **Implication: keep spinners for ServeLocal's local/fast API; skeletons
  are a post-deploy item once real network latency exists.**

### 4. Typography / spacing rhythm
- Professional tells: constrained spacing scale (4/8/16/24/32/48/64), hierarchy from **weight+color
  more than size**, 2–3 weights max, generous-by-default whitespace. ServeLocal's editorial system
  already complies — no structural change warranted. ([Refactoring UI summaries](https://www.sglavoie.com/posts/book-summary-refactoring-ui/), [refactoringui.com](https://refactoringui.com/), [Adham Dannaway's 16 tips](https://www.adhamdannaway.com/blog/ui-design/ui-design-tips))
- Cheap pro touches: `text-wrap: balance` on display headings; `font-variant-numeric: tabular-nums`
  on stat numbers so counters don't jitter; branded `::selection`. (practitioner consensus, single-source-level — low risk)

### 5. Amateur tells to eliminate (ranked by visibility)
1. Interactive elements with missing states (no active, no focus-visible) — touched every session.
2. Default blue UA focus rings mixed with none at all — inconsistency reads unfinished.
3. `transition: all` side effects (things animating that shouldn't).
4. Motion that ignores OS reduced-motion settings.
5. Overcrowding/inconsistent spacing (not present in the editorial system).

## Prioritized checklist (applied to this codebase)

| # | Change | Where | Why |
|---|---|---|---|
| 1 | Press feedback: `scale(.97)` on `:active`, 160ms ease-out, gated `prefers-reduced-motion: no-preference` | all `.v1` pressables + shadcn `Button` | finding 1 |
| 2 | Branded `:focus-visible`: 2px green outline, 2px offset; white on dark bands (pledge, footer) | `.v1` global | finding 2, WCAG 2.4.13-quality |
| 3 | Kill all 8 `transition: all` → explicit property lists incl. `scale` | `v1.css` | finding 1/5 |
| 4 | `prefers-reduced-motion: reduce` → pause marquee, no press scale | `v1.css` | finding 2 |
| 5 | `tabular-nums` on stat numbers; `text-wrap: balance` on display headings; brand `::selection` | `v1.css` | finding 4 |
| 6 | Keep 0.7s spinner; defer skeletons until deployed latency is real | — | finding 3 |

## What would change this conclusion
- Real usability testing on ServeLocal showing users read heavier motion/decoration as higher quality
  (would revive H2 for the marketing pages only).
- Deployed p50 API latency >500ms (would promote skeletons from deferred to #1 per NN/g threshold).

## Sources
All accessed 2026-07-13: [W3C WCAG 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) · [W3C WCAG 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) · [Sara Soueidan on focus indicators](https://www.sarasoueidan.com/blog/focus-indicators/) · [a11y-collective](https://www.a11y-collective.com/blog/focus-indicator/) · [TestParty WCAG guide](https://testparty.ai/blog/wcag-focus-visible-guide) · [web.dev prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion) · [web.dev Learn a11y: motion](https://web.dev/learn/accessibility/motion) · [Tatiana Mac no-motion-first](https://www.tatianamac.com/posts/prefers-reduced-motion) · [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) · [NN/g Skeleton Screens 101](https://www.nngroup.com/articles/skeleton-screens/) · [NN/g skeletons vs spinners video](https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/) · [ResearchGate skeleton-screens study](https://www.researchgate.net/publication/326858669_The_effect_of_skeleton_screens_Users'_perception_of_speed_and_ease_of_navigation) · [equal.design motion rules](https://www.equal.design/blog/5-rules-for-motion-in-ui-transitions) · [appypie 200ms rule](https://www.appypie.com/blog/mobile-app-animation-guide) · [design.dev CSS transitions](https://design.dev/guides/css-transitions/) · [Refactoring UI summary (sglavoie)](https://www.sglavoie.com/posts/book-summary-refactoring-ui/) · [refactoringui.com](https://refactoringui.com/) · [Adham Dannaway 16 UI tips](https://www.adhamdannaway.com/blog/ui-design/ui-design-tips) · in-repo `emil-design-eng` skill (Emil Kowalski's published course material).
