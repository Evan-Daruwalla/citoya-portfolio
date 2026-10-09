// Stripe Checkout lives on one host (2026-09-30, audit DN / record DR): the billing page
// used to follow any URL the API returned, so a tampered or buggy response could send an
// org anywhere.
export function isStripeCheckoutUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}
