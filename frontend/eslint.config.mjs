import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import jsxA11y from "eslint-plugin-jsx-a11y";

// Flat config, replacing the `.eslintrc.json` that `next lint` used to read.
// Next 16 removed `next lint` entirely, so `npm run lint` now invokes the ESLint
// CLI directly — which only understands flat config (2026-08-07).
//
// Two things `next lint` did implicitly and the CLI does not:
//   1. Ignored build output. Flat config has no `.eslintignore`, so `ignores`
//      below has to list it or ESLint lints `.next/` and never finishes.
//   2. Resolved `plugin:jsx-a11y/recommended` through eslint-config-next's own
//      transitive copy of the plugin. Flat config imports plugins for real, so
//      jsx-a11y is now a direct devDependency.
const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  {
    // Only the RULES are spread, not the whole flat config: eslint-config-next
    // already registers the jsx-a11y plugin, and re-registering it is a hard
    // "Cannot redefine plugin" config error.
    rules: {
      // eslint-config-next turns on only 6 jsx-a11y rules; the full `recommended`
      // set is deliberate (audit 2026-08-06 enabled it and fixed the 26 errors
      // that fell out), so it stays spread in after the Next config.
      ...jsxA11y.flatConfigs.recommended.rules,
      // The v1 forms label controls by wrapping OR by htmlFor; either is fine.
      "jsx-a11y/label-has-associated-control": ["error", { assert: "either" }],

      // --- React Compiler rules, new in eslint-plugin-react-hooks v7 ---
      // The Next 15->16 bump took this plugin from v5 to v7, which added rules
      // the previous gate never ran. Demoted to `warn` (visible in the log, not
      // blocking) rather than fixed or silenced, because the 12 sites they flag
      // are load-bearing auth/data-fetch code and the frontend has no test
      // runner — the only regression check is clicking through by hand.
      //
      // `set-state-in-effect` (8 sites) is largely a false positive for this
      // app's shape: the JWT lives in localStorage (ADR-0001), which cannot be
      // read during render without breaking SSR hydration, so seeding state
      // inside an effect is the correct pattern here, not a mistake. Complying
      // literally in `lib/auth-context.tsx` would introduce a hydration bug.
      //
      // `preserve-manual-memoization` (4 sites, all app/applicants/page.tsx)
      // is a real nit: those useMemos depend on `nowMs` from a render-time
      // `new Date()`, so they never actually memoize. Harmless on arrays this
      // small; worth cleaning up on the next pass through that page.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default config;
