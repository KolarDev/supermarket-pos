/**
 * Money arithmetic for the till.
 *
 * VAT and rounding live here rather than inside the store so that the seeded
 * sales history is priced by exactly the same rules the register uses. A demo
 * whose ledger disagrees with its own receipts is worse than no demo, and the
 * only way to guarantee agreement is to have one implementation.
 */

/** Nigeria's standard VAT rate. */
export const VAT_RATE = 0.075

/** Naira carries kobo — round money at every step so VAT can't drift. */
export const round2 = (value: number) => Math.round(value * 100) / 100

export interface PricedLine {
  unitPrice: number
  quantity: number
}

export interface SaleTotals {
  subtotal: number
  vat: number
  total: number
}

/**
 * Prices a basket. Prices are quoted VAT-exclusive, so the customer pays the
 * subtotal plus 7.5% — this is what the POS summary, the receipt and the
 * dashboard all report.
 */
export function priceLines(lines: readonly PricedLine[], discount = 0): SaleTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0))
  const vat = round2(subtotal * VAT_RATE)
  return { subtotal, vat, total: round2(subtotal + vat - discount) }
}
