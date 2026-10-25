/**
 * Bot honeypot (2026-10-21). Humans never see or fill this field; the server treats any
 * value in `website` (the JSON key the pages send) as a bot. The input's own `name` is
 * deliberately not one autofill recognises, and the data-* hints tell password managers to
 * skip it: a filled honeypot made a real user's login count as a bot and made
 * forgot-password send nothing (2026-10-24, audit GE #28). Hidden off-screen, not display:none (some bots skip
 * display:none fields). aria-hidden plus tabIndex -1 keep it away from assistive tech
 * and keyboard users.
 */
export function HoneypotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
    >
      <label>
        Leave this empty
        <input type="text" name="cy_hp_extra" tabIndex={-1} autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true" data-form-type="other" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}
