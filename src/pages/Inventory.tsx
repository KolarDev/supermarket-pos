import { useMemo, useState } from 'react'
import { StockAdjustmentModal } from '../components/StockAdjustmentModal'
import { useStore } from '../context/StoreContext'
import type { Product, StockMovementType } from '../types/pos'
import { formatDateTime } from '../utils/format'
import { STOCK_BADGES, getStockStatus, needsAttention } from '../utils/stock'

/**
 * Ledger colour coding. Sales and damage both reduce stock but mean very
 * different things to an auditor, so they get different badges.
 */
const MOVEMENT_BADGES: Record<StockMovementType, { label: string; className: string }> = {
  OPENING_STOCK: { label: 'Opening Stock', className: 'bg-slate-100 text-slate-600 ring-slate-300' },
  SALE: { label: 'Sale', className: 'bg-danger-50 text-danger-800 ring-danger-200' },
  PURCHASE: { label: 'Purchase', className: 'bg-success-50 text-success-800 ring-success-200' },
  DAMAGE: { label: 'Damage', className: 'bg-warning-50 text-warning-700 ring-warning-200' },
  ADJUSTMENT: { label: 'Adjustment', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
}

const MOVEMENT_TYPES = Object.keys(MOVEMENT_BADGES) as StockMovementType[]

const formatDelta = (delta: number) => (delta > 0 ? `+${delta}` : String(delta))

export default function Inventory() {
  const { products, movements } = useStore()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<StockMovementType | 'ALL'>('ALL')
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)

  /** Reorder list: lowest stock first, so the worst offender is top-left. */
  const attention = useMemo(
    () => products.filter(needsAttention).sort((a, b) => a.stock - b.stock),
    [products],
  )

  const outOfStockCount = attention.filter((product) => product.stock <= 0).length

  const filteredMovements = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...movements]
      // The store already prepends new movements, but sorting here means the
      // ledger cannot be thrown out of order by an imported or replayed batch.
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
      .filter((movement) => {
        if (typeFilter !== 'ALL' && movement.type !== typeFilter) return false
        if (!query) return true
        return (
          movement.productName.toLowerCase().includes(query) ||
          movement.reason.toLowerCase().includes(query)
        )
      })
  }, [movements, search, typeFilter])

  return (
    <div className="space-y-6 p-4 lg:h-full lg:overflow-y-auto lg:p-6 print:hidden">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Inventory Ledger
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Live stock levels and the full movement audit trail.
        </p>
      </header>

      {/* ============================================ low / out of stock */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Needs Attention</h2>
            <p className="text-xs text-slate-500">
              Items at or below their reorder threshold.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-danger-50 px-3 py-1 text-xs font-medium text-danger-800 ring-1 ring-danger-200 tabular-nums">
              {outOfStockCount} out of stock
            </span>
            <span className="rounded-full bg-warning-50 px-3 py-1 text-xs font-medium text-warning-700 ring-1 ring-warning-200 tabular-nums">
              {attention.length - outOfStockCount} low
            </span>
          </div>
        </div>

        {attention.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Every line is above its reorder threshold.
          </p>
        ) : (
          <ul className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {attention.map((product) => {
              const badge = STOCK_BADGES[getStockStatus(product)]
              const shortfall = Math.max(0, product.minStock - product.stock)
              return (
                <li
                  key={product.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4"
                >
                  <div>
                    <p className="text-sm font-medium leading-snug text-slate-900">
                      {product.name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{product.sku}</p>
                  </div>

                  <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    {product.category}
                  </span>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 tabular-nums">
                      Stock <strong className="font-semibold text-slate-900">{product.stock}</strong>{' '}
                      / Min {product.minStock}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ring-1 ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  {shortfall > 0 && (
                    <p className="text-xs text-warning-700">Reorder {shortfall} to reach minimum.</p>
                  )}

                  <button
                    type="button"
                    onClick={() => setAdjustingProduct(product)}
                    className="mt-auto rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-800"
                  >
                    Adjust Stock
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ================================================ audit trail */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Stock Movement Log</h2>
            <p className="text-xs text-slate-500">
              Newest first · {filteredMovements.length} of {movements.length} entries
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product or reason…"
              aria-label="Search movements"
              className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
            />
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as StockMovementType | 'ALL')
              }
              aria-label="Filter by movement type"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
            >
              <option value="ALL">All types</option>
              {MOVEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MOVEMENT_BADGES[type].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredMovements.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No movements match the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-5 py-2.5 font-medium">Timestamp</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Qty</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Reason</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map((movement) => {
                  const badge = MOVEMENT_BADGES[movement.type]
                  const isIncrease = movement.quantityDelta > 0
                  return (
                    <tr key={movement.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500 tabular-nums">
                        {formatDateTime(movement.timestamp)}
                      </td>
                      <td className="px-5 py-3 text-slate-800">{movement.productName}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-semibold tabular-nums ${
                          isIncrease ? 'text-success-700' : 'text-danger-700'
                        }`}
                      >
                        {formatDelta(movement.quantityDelta)}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{movement.reason}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                        {movement.user}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adjustingProduct && (
        <StockAdjustmentModal
          key={adjustingProduct.id}
          product={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
        />
      )}
    </div>
  )
}
