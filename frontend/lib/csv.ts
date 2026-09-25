/**
 * CSV cell escaping for exports (2026-09-15, daily-audit Appendix F MEDIUM).
 *
 * The roster export quoted cells and doubled embedded quotes, which makes a
 * well-formed CSV and does nothing about FORMULA INJECTION. Excel, Google Sheets
 * and LibreOffice treat a cell whose text begins `=`, `+`, `-` or `@` as a
 * formula, so a student whose name is stored as `=HYPERLINK("http://x","click")`
 * becomes a live link in the organiser's spreadsheet — and the organiser is
 * exactly the person who opens this file. The values here are attacker-supplied
 * in the ordinary sense: students type their own names at registration.
 *
 * Prefixing a single quote is the standard neutralisation — spreadsheets read it
 * as "this is text" and do not display it. The tab and carriage-return cases are
 * included because both are also treated as formula starts once a leading
 * whitespace character is stripped by the importer.
 *
 * This lives in `lib/` rather than inline in the page so it can actually be
 * tested: `backend/tests/test_csv_injection.py` imports THIS file in Node and
 * asserts on real output. Inline in a component it was unreachable by any test
 * the project runs.
 */

/** Characters a spreadsheet treats as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Escape one value for a CSV cell: neutralise a leading formula character, then
 * quote-double and wrap. Always returns a quoted cell.
 */
export function csvCell(value: string): string {
  const neutralised = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${neutralised.replace(/"/g, '""')}"`;
}

/** Join rows of raw values into a CSV document, escaping every cell. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
