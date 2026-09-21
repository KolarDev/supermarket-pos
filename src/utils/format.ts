/**
 * Currency formatting for the POS.
 *
 * A single module-level `Intl.NumberFormat` is reused on purpose: constructing
 * one is comparatively expensive, and the product grid calls this formatter
 * dozens of times per render.
 */
const nairaFormatter = new Intl.NumberFormat('en-NG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formats an amount as Nigerian Naira, e.g. `₦1,500.00`.
 *
 * Non-finite input degrades to `₦0.00` rather than rendering `₦NaN` on a
 * customer-facing receipt or a tender readout.
 */
export function formatNaira(amount: number): string {
  if (!Number.isFinite(amount)) return '₦0.00'
  return `₦${nairaFormatter.format(amount)}`
}

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * Compact Naira for chart axes and other tight spaces: `₦850`, `₦12.4k`,
 * `₦1.2m`.
 *
 * A full `₦12,400.00` label above a bar is wider than the bar itself, and the
 * dashboard axis only needs the magnitude — the exact figure is one hover away.
 * Trailing `.0` is dropped so a round thousand reads `₦12k`, not `₦12.0k`.
 */
export function formatNairaCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '₦0'
  const scaled = (unit: number) => `₦${(amount / unit).toFixed(1).replace(/\.0$/, '')}`
  const magnitude = Math.abs(amount)
  if (magnitude >= 1_000_000) return `${scaled(1_000_000)}m`
  if (magnitude >= 1_000) return `${scaled(1_000)}k`
  return `₦${Math.round(amount)}`
}

/**
 * Formats an instant for the stock audit ledger: `2026-09-21 14:42:00`.
 *
 * ISO-like and zero-padded on purpose — it sorts correctly as text, and every
 * row in the ledger lines up in a monospaced column.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}
