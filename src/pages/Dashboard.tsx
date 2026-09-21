/**
 * Executive summary for the store manager.
 *
 * Every figure on this page — the KPIs, the chart, the top-seller ranking and
 * the transactions table — is derived from the same `sales` history the till
 * writes to. Nothing here is separately mocked, so a sale rung up on the
 * register moves all four sections at once, which is the point of the screen.
 */
import { useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  AlertIcon,
  ArrowRightIcon,
  BanknoteIcon,
  ReceiptIcon,
  TrendingUpIcon,
  WarehouseIcon,
} from '../components/Icons'
import { ThermalReceiptModal } from '../components/ThermalReceiptModal'
import { useStore } from '../context/StoreContext'
import type { Page } from '../types/nav'
import type { PaymentMethod, Sale } from '../types/pos'
import { formatDateTime, formatNaira, formatNairaCompact } from '../utils/format'
import { buildDailyTrend, recentSales, summariseToday, topSellers } from '../utils/sales'
import type { DailyTotal, TopSeller } from '../utils/sales'
import { needsAttention } from '../utils/stock'

/** Constructing an `Intl` formatter is expensive — build it once, not per render. */
const LONG_DATE = new Intl.DateTimeFormat('en-NG', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const PAYMENT_BADGES: Record<PaymentMethod, string> = {
  CASH: 'bg-success-50 text-success-800 ring-success-200',
  CARD: 'bg-brand-100 text-brand-800 ring-brand-200',
  TRANSFER: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
}

interface KpiProps {
  label: string
  value: string
  sub: ReactNode
  icon: ReactElement
  tone?: 'neutral' | 'danger'
  /** Given only for the alert card, which doubles as a shortcut. */
  onClick?: () => void
}

function Kpi({ label, value, sub, icon, tone = 'neutral', onClick }: KpiProps) {
  const danger = tone === 'danger'
  const shell =
    'flex w-full flex-col gap-3 rounded-xl border bg-white px-4 py-4 text-left shadow-sm transition'
  // Spans rather than `p`/`div`: this markup lives inside a `<button>` on the
  // alert card, and a button may only contain phrasing content.
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            danger ? 'bg-danger-50 text-danger-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {icon}
        </span>
      </span>
      <span className="flex flex-col">
        <span
          className={`text-2xl font-semibold tabular-nums ${
            danger ? 'text-danger-700' : 'text-slate-900'
          }`}
        >
          {value}
        </span>
        <span className="mt-0.5 text-xs text-slate-500">{sub}</span>
      </span>
    </>
  )

  if (!onClick) return <div className={`${shell} border-slate-200`}>{body}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${shell} border-danger-200 hover:border-danger-400 hover:shadow-md`}
    >
      {body}
      <span className="flex items-center gap-1 text-xs font-semibold text-danger-700">
        Review stock
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </span>
    </button>
  )
}

/**
 * Seven days of takings as a bare CSS column chart — no charting dependency,
 * and the bars scale off the week's own peak so a quiet week still reads.
 */
function SalesChart({
  trend,
  periodTotal,
  periodCount,
}: {
  trend: DailyTotal[]
  periodTotal: number
  periodCount: number
}) {
  const peak = Math.max(...trend.map((day) => day.total), 1)
  const lastIndex = trend.length - 1

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Sales Overview</h2>
          <p className="text-xs text-slate-500">Daily takings, last 7 days</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-900 tabular-nums">
            {formatNaira(periodTotal)}
          </p>
          <p className="text-xs text-slate-500">
            {periodCount} transaction{periodCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Value row, bars and day labels share one 7-column grid so they stack
          into columns without any of them having to be positioned. */}
      <div className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-3">
        {trend.map((day) => (
          <p
            key={day.key}
            className="text-center text-[10px] font-medium text-slate-500 tabular-nums"
          >
            {day.total > 0 ? formatNairaCompact(day.total) : '—'}
          </p>
        ))}
      </div>

      <div className="mt-1.5 grid h-40 grid-cols-7 gap-1.5 sm:gap-3">
        {trend.map((day, index) => {
          const isToday = index === lastIndex
          // A non-zero day always shows *something*, even a slow one.
          const height = day.total > 0 ? Math.max((day.total / peak) * 100, 3) : 0
          return (
            <div
              key={day.key}
              className="flex flex-col justify-end"
              title={`${isToday ? 'Today' : day.label} · ${formatNaira(day.total)} · ${
                day.count
              } sale${day.count === 1 ? '' : 's'}`}
            >
              <div
                className={`w-full rounded-t-md ${isToday ? 'bg-brand-900' : 'bg-brand-300'}`}
                style={{ height: `${height}%` }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1.5 border-t border-slate-100 pt-2 sm:gap-3">
        {trend.map((day, index) => (
          <p
            key={day.key}
            className={`text-center text-[11px] ${
              index === lastIndex ? 'font-semibold text-brand-900' : 'text-slate-500'
            }`}
          >
            {index === lastIndex ? 'Today' : day.label}
          </p>
        ))}
      </div>

      {periodCount === 0 && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
          No sales recorded in this window. Ring one up on the POS register.
        </p>
      )}
    </section>
  )
}

function TopSellers({ sellers }: { sellers: TopSeller[] }) {
  // Bars are relative to the best seller, not to the total — the ranking is the
  // message, not each line's share of the week.
  const peak = sellers[0]?.units ?? 1

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Top Sellers</h2>
          <p className="text-xs text-slate-500">By units sold, last 7 days</p>
        </div>
        <TrendingUpIcon className="h-5 w-5 shrink-0 text-slate-300" />
      </div>

      {sellers.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Nothing has sold in the last 7 days.</p>
      ) : (
        <ol className="mt-5 space-y-3.5">
          {sellers.map((seller, index) => (
            <li key={seller.productId} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600 tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{seller.name}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-900"
                    style={{ width: `${(seller.units / peak) * 100}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-900 tabular-nums">
                  {seller.units}
                </p>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  {formatNaira(seller.revenue)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { products, sales } = useStore()
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)

  const today = useMemo(() => summariseToday(sales), [sales])
  const trend = useMemo(() => buildDailyTrend(sales), [sales])
  const sellers = useMemo(() => topSellers(sales), [sales])
  const recent = useMemo(() => recentSales(sales, 5), [sales])

  const stock = useMemo(() => {
    // Scoped to active lines, matching the Products page — a discontinued line
    // sitting at zero is not something anyone needs to reorder.
    const attention = products.filter(needsAttention)
    return {
      skus: products.length,
      value: products.reduce((total, item) => total + item.stock * item.sellingPrice, 0),
      attention: attention.length,
      outOfStock: attention.filter((item) => item.stock <= 0).length,
      low: attention.filter((item) => item.stock > 0).length,
    }
  }, [products])

  const periodTotal = useMemo(() => trend.reduce((sum, day) => sum + day.total, 0), [trend])
  const periodCount = useMemo(() => trend.reduce((sum, day) => sum + day.count, 0), [trend])

  return (
    <>
      <div className="space-y-6 p-4 lg:h-full lg:overflow-y-auto lg:p-6 print:hidden">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Store Dashboard
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{LONG_DATE.format(new Date())}</p>
          </div>
          <p className="text-sm text-slate-500">
            {today.count > 0
              ? `${today.count} sale${today.count === 1 ? '' : 's'} completed today`
              : 'No sales yet today'}
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Today's Sales"
            value={formatNaira(today.total)}
            sub={`across ${today.count} transaction${today.count === 1 ? '' : 's'}`}
            icon={<BanknoteIcon className="h-4 w-4" />}
          />
          <Kpi
            label="Total Transactions"
            value={String(today.count)}
            sub={`${formatNaira(today.averageBasket)} average basket`}
            icon={<ReceiptIcon className="h-4 w-4" />}
          />
          <Kpi
            label="Inventory Valuation"
            value={formatNaira(stock.value)}
            sub={`${stock.skus} SKUs valued at retail`}
            icon={<WarehouseIcon className="h-4 w-4" />}
          />
          <Kpi
            label="Stock Alerts"
            value={String(stock.attention)}
            tone="danger"
            sub={`${stock.outOfStock} out of stock · ${stock.low} low`}
            icon={<AlertIcon className="h-4 w-4" />}
            onClick={() => onNavigate('inventory')}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[3fr_2fr]">
          <SalesChart trend={trend} periodTotal={periodTotal} periodCount={periodCount} />
          <TopSellers sellers={sellers} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Recent Transactions</h2>
            <p className="text-xs text-slate-500">
              {recent.length} most recent of {sales.length} completed sale
              {sales.length === 1 ? '' : 's'}
            </p>
          </div>

          {recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No sales recorded yet. Ring one up on the POS register.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-medium">Receipt</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Date &amp; Time</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Cashier</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Payment</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Total</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs font-medium text-slate-900">
                        {sale.receiptNumber}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-600 tabular-nums">
                        {formatDateTime(sale.timestamp)}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{sale.cashier}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${PAYMENT_BADGES[sale.paymentMethod]}`}
                        >
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">
                        {formatNaira(sale.total)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setReceiptSale(sale)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-slate-700 transition hover:bg-slate-100"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Outside the scrolling wrapper, and print-hidden along with it: the
          receipt is the only thing this app is ever allowed to put on paper. */}
      <ThermalReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />
    </>
  )
}
