/**
 * Sales reporting for the dashboard.
 *
 * Everything the manager dashboard shows is derived from the `sales` history —
 * the KPIs, the chart, the top-seller list and the transactions table all read
 * the same rows. Nothing is separately mocked, so a sale rung up on the till
 * moves every number on the page at once.
 *
 * Days are counted in local time: a sale belongs to the day the operator rang
 * it up, not to the UTC day its timestamp happens to fall in.
 */
import type { Sale } from '../types/pos'
import { round2 } from './money'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Exported so callers can build the 7-day window without duplicating the rule. */
export const TREND_DAYS = 7

const pad = (value: number) => String(value).padStart(2, '0')

/** Local calendar day as `YYYY-MM-DD`. Invalid dates yield a key nothing matches. */
export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const parse = (iso: string): Date | null => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Midnight local, `daysAgo` days back. The `Date` constructor normalises. */
const startOfDay = (daysAgo: number, now: Date): Date =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo)

export interface TodaySummary {
  /** Takings including VAT — what the drawer should hold. */
  total: number
  count: number
  /** Average completed basket today; 0 when nothing has been rung up. */
  averageBasket: number
}

/** Headline figures for the current trading day. */
export function summariseToday(sales: Sale[], now = new Date()): TodaySummary {
  const today = dayKey(now)
  let total = 0
  let count = 0

  for (const sale of sales) {
    const date = parse(sale.timestamp)
    if (!date || dayKey(date) !== today) continue
    total += sale.total
    count += 1
  }

  total = round2(total)
  return { total, count, averageBasket: count === 0 ? 0 : round2(total / count) }
}

export interface DailyTotal {
  key: string
  /** Weekday abbreviation, or `Today` in the UI for the final bucket. */
  label: string
  total: number
  count: number
}

/**
 * Takings bucketed per day over the trailing window, oldest first — the order
 * a chart reads left to right. Days with no trade are kept as zero buckets so
 * a quiet Sunday shows as a gap rather than collapsing the axis.
 */
export function buildDailyTrend(
  sales: Sale[],
  days = TREND_DAYS,
  now = new Date(),
): DailyTotal[] {
  const buckets: DailyTotal[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = startOfDay(offset, now)
    buckets.push({ key: dayKey(date), label: DAY_LABELS[date.getDay()], total: 0, count: 0 })
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  for (const sale of sales) {
    const date = parse(sale.timestamp)
    if (!date) continue
    const bucket = byKey.get(dayKey(date))
    if (!bucket) continue
    bucket.total = round2(bucket.total + sale.total)
    bucket.count += 1
  }

  return buckets
}

export interface TopSeller {
  productId: string
  name: string
  units: number
  revenue: number
}

/**
 * Best sellers by units moved across the trailing window.
 *
 * Units rather than revenue: a shop reorders what leaves the shelf, and a
 * single bulk sale shouldn't bury a line that sells every day. Names come from
 * the item snapshots on the sales, ranked by units then by revenue so ties are
 * broken deterministically.
 */
export function topSellers(
  sales: Sale[],
  limit = 5,
  days = TREND_DAYS,
  now = new Date(),
): TopSeller[] {
  const since = startOfDay(days - 1, now)
  const totals = new Map<string, TopSeller>()

  for (const sale of sales) {
    const date = parse(sale.timestamp)
    if (!date || date < since) continue
    for (const item of sale.items) {
      const { id, name, sellingPrice } = item.product
      const running = totals.get(id) ?? { productId: id, name, units: 0, revenue: 0 }
      running.units += item.quantity
      running.revenue = round2(running.revenue + sellingPrice * item.quantity)
      totals.set(id, running)
    }
  }

  return Array.from(totals.values())
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, limit)
}

/**
 * Most recent sales first.
 *
 * The store keeps `sales` newest-first already, but the sort is repeated here
 * because persisted state written by an older build may not honour that, and a
 * dashboard showing the wrong five rows is a silent bug.
 */
export function recentSales(sales: Sale[], limit = 5): Sale[] {
  return [...sales]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
    .slice(0, limit)
}
