/**
 * Tender arithmetic for the checkout.
 *
 * The split-payment panel needs a running total to keep the "Complete Sale"
 * button honest, and `completeSale` needs the same rules before it writes
 * anything. Both call these functions rather than deriving the rules twice, so
 * the button can never be enabled for a sale the store would reject — or
 * disabled for one it would happily take.
 *
 * Same reasoning as `priceLines`: a demo whose checkout disagrees with its own
 * store is worse than no demo, and the only guarantee is one implementation.
 */
import type { PaymentMethod, Settlement, Tender } from '../types/pos'
import { formatNaira } from './format'
import { round2 } from './money'

/** The order tenders are listed in, on the checkout panel and on the receipt. */
export const TENDER_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER']

/**
 * Drops the entries that are not real money and rounds what is left.
 *
 * A blank field parses to `NaN` and a half-typed "-" to a negative; neither is
 * a tender, and neither may reach the arithmetic or the receipt.
 */
export function normaliseTenders(payments: readonly Tender[]): Tender[] {
  return payments
    .filter((tender) => Number.isFinite(tender.amount) && tender.amount > 0)
    .map((tender) => ({ method: tender.method, amount: round2(tender.amount) }))
}

/** Everything handed over, summed across methods. */
export function tenderTotal(payments: readonly Tender[]): number {
  return round2(
    normaliseTenders(payments).reduce((sum, tender) => sum + tender.amount, 0),
  )
}

/** What was put on the counter in cash — the only tender change can be paid from. */
export function cashTendered(payments: readonly Tender[]): number {
  return round2(
    normaliseTenders(payments)
      .filter((tender) => tender.method === 'CASH')
      .reduce((sum, tender) => sum + tender.amount, 0),
  )
}

/**
 * Collapses a tender list to the one-line summary stored on the sale.
 *
 * An empty list reports `'CASH'` rather than a third state: `completeSale`
 * refuses to write a sale with nothing tendered, so this branch is unreachable
 * from stored data and exists only so the return type stays total.
 */
export function settlementOf(payments: readonly Tender[]): Settlement {
  const methods = new Set(normaliseTenders(payments).map((tender) => tender.method))
  if (methods.size <= 1) return [...methods][0] ?? 'CASH'
  return 'SPLIT'
}

/** Positive when the customer is owed change, negative when they are short. */
export function balanceDue(payments: readonly Tender[], total: number): number {
  return round2(tenderTotal(payments) - total)
}

/**
 * Why these tenders cannot settle `total`, or `null` if they can.
 *
 * Returns the message rather than throwing so the checkout panel can show it
 * while the operator is still typing, and `completeSale` can throw the same
 * string once it is asked to commit. One wording, two audiences.
 */
export function tenderProblem(payments: readonly Tender[], total: number): string | null {
  const tenders = normaliseTenders(payments)
  if (tenders.length === 0) return 'Enter how the customer is paying.'

  const paid = tenderTotal(tenders)
  if (paid < total) {
    return `Short by ${formatNaira(round2(total - paid))} — ${formatNaira(total)} is due.`
  }

  // A card terminal cannot hand back cash, so change can only come out of the
  // notes the customer actually put down. Without this rule a ₦20,000 card
  // tender against a ₦10,000 bill would "give" ₦10,000 of change — the kind of
  // mistake that empties a drawer over a week.
  const change = round2(paid - total)
  const cash = cashTendered(tenders)
  if (change > cash) {
    return (
      `Change of ${formatNaira(change)} is more than the ${formatNaira(cash)} ` +
      'tendered in cash — a card or transfer cannot make change.'
    )
  }

  return null
}

/**
 * What the checkout panel says about where the sale stands.
 *
 * This lives here rather than inline in the JSX because `balanceDue`'s sign is
 * easy to read backwards — positive means the customer has *overpaid* — and the
 * panel shipped that inversion once. One function, one place to be right, and a
 * seam the harness can drive without a browser.
 */
export type CheckoutBanner =
  /** Underpaid. `amount` is what is still owed, always positive. */
  | { kind: 'DUE'; amount: number }
  /** Overpaid and the drawer can cover it. `amount` is the change, positive. */
  | { kind: 'CHANGE'; amount: number }
  | { kind: 'EXACT' }
  /** Settled or not, something blocks the sale. `message` says what. */
  | { kind: 'BLOCKED'; message: string }

export function checkoutBanner(
  payments: readonly Tender[],
  total: number,
): CheckoutBanner {
  const balance = balanceDue(payments, total)
  const problem = tenderProblem(payments, total)

  if (balance > 0) {
    // Overpaid. Change is owed — unless the cash portion cannot cover it, which
    // is the one thing still wrong at this point.
    return problem ? { kind: 'BLOCKED', message: problem } : { kind: 'CHANGE', amount: balance }
  }
  if (balance < 0) return { kind: 'DUE', amount: round2(-balance) }
  // Settled to the kobo. A problem here can only be that nothing was tendered
  // against a zero bill, which is still nothing to bank.
  return problem ? { kind: 'BLOCKED', message: problem } : { kind: 'EXACT' }
}
