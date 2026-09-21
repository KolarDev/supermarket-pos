import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useStore } from '../context/StoreContext'
import type { Product } from '../types/pos'
import type { AdjustmentKind } from '../utils/stock'
import { STOCK_BADGES, computeAdjustmentDelta, getStockStatus } from '../utils/stock'

interface StockAdjustmentModalProps {
  product: Product | null
  onClose: () => void
}

const KINDS: { kind: AdjustmentKind; label: string; hint: string; activeClassName: string }[] = [
  {
    kind: 'PURCHASE',
    label: 'Purchase',
    hint: 'Stock received',
    activeClassName: 'border-success-600 bg-success-50 text-success-800',
  },
  {
    kind: 'DAMAGE',
    label: 'Damage',
    hint: 'Written off',
    activeClassName: 'border-warning-600 bg-warning-50 text-warning-800',
  },
  {
    kind: 'ADJUSTMENT',
    label: 'Correction',
    hint: 'Audit fix +/−',
    activeClassName: 'border-indigo-600 bg-indigo-50 text-indigo-700',
  },
]

export function StockAdjustmentModal({ product, onClose }: StockAdjustmentModalProps) {
  const { adjustStock } = useStore()

  const [kind, setKind] = useState<AdjustmentKind>('PURCHASE')
  /** Non-negative integer only — sign is carried by `kind` / `direction`. */
  const [quantity, setQuantity] = useState('')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [reason, setReason] = useState('')

  const quantityRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!product) return
    quantityRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [product, onClose])

  if (!product) return null

  const parsedQuantity = Number.parseInt(quantity, 10)
  const hasQuantity = Number.isInteger(parsedQuantity) && parsedQuantity > 0
  const delta = computeAdjustmentDelta(kind, parsedQuantity, direction)
  const resultingStock = product.stock + delta
  const status = getStockStatus(product)
  const badge = STOCK_BADGES[status]

  // `adjustStock` clamps at zero, which would silently record a movement of -50
  // against 3 units. Refuse the entry instead so the ledger stays truthful.
  const oversell = resultingStock < 0
  const missingReason = reason.trim().length === 0
  const canApply = hasQuantity && !oversell && !missingReason

  let validationError: string | null = null
  if (quantity.length > 0 && !hasQuantity) {
    validationError = 'Enter a whole number of 1 or more.'
  } else if (oversell) {
    validationError = `Only ${product.stock} in stock — cannot remove ${parsedQuantity}.`
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canApply) return
    adjustStock(product.id, delta, reason.trim(), kind)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-auto flex min-h-full max-w-lg items-center justify-center"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Adjust stock for ${product.name}`}
      >
        <form
          onSubmit={handleSubmit}
          className="w-full rounded-xl bg-white shadow-2xl ring-1 ring-slate-300"
        >
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Adjust Stock</h2>
              <p className="text-xs text-slate-500">
                Every change is written to the stock ledger.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </header>

          {/* ------------------------------------------------ product summary */}
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm font-medium text-slate-900">{product.name}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {product.sku} · {product.barcode}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${badge.className}`}
              >
                {badge.label}
              </span>
              <span className="text-xs text-slate-600 tabular-nums">
                Current: <strong className="font-semibold">{product.stock}</strong> · Min:{' '}
                {product.minStock}
              </span>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            {/* ------------------------------------------------------- kind */}
            <fieldset>
              <legend className="mb-1.5 block text-xs font-medium text-slate-600">
                Adjustment type
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {KINDS.map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    aria-pressed={kind === option.kind}
                    onClick={() => setKind(option.kind)}
                    className={`rounded-lg border px-2 py-2.5 text-center transition ${
                      kind === option.kind
                        ? option.activeClassName
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] opacity-80">{option.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* -------------------------------------------------- direction */}
            {kind === 'ADJUSTMENT' && (
              <fieldset>
                <legend className="mb-1.5 block text-xs font-medium text-slate-600">
                  Direction
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {([1, -1] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={direction === value}
                      onClick={() => setDirection(value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        direction === value
                          ? 'border-brand-900 bg-brand-900 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {value === 1 ? '+ Add stock' : '− Remove stock'}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {/* --------------------------------------------------- quantity */}
            <div>
              <label htmlFor="quantity" className="mb-1.5 block text-xs font-medium text-slate-600">
                Quantity ({kind === 'DAMAGE' ? 'units lost' : 'units'})
              </label>
              <input
                id="quantity"
                ref={quantityRef}
                inputMode="numeric"
                autoComplete="off"
                value={quantity}
                // Strip non-digits at the source so the field can never hold a
                // sign or decimal point that the parser would silently drop.
                onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-right text-lg font-semibold tabular-nums outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
              />
            </div>

            {/* ------------------------------------------------- resulting */}
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200">
              <span className="text-slate-500">Resulting stock</span>
              <span className="tabular-nums">
                <span className="text-slate-500">{product.stock}</span>
                <span className="mx-1.5 text-slate-400">→</span>
                <strong
                  className={`font-semibold ${
                    resultingStock < 0 ? 'text-danger-700' : 'text-slate-900'
                  }`}
                >
                  {resultingStock}
                </strong>
                {delta !== 0 && (
                  <span
                    className={`ml-2 text-xs font-medium ${
                      delta > 0 ? 'text-success-700' : 'text-danger-700'
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </span>
            </div>

            {/* ----------------------------------------------------- reason */}
            <div>
              <label htmlFor="reason" className="mb-1.5 block text-xs font-medium text-slate-600">
                Reason / notes
              </label>
              <input
                id="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  kind === 'PURCHASE'
                    ? 'e.g. Supplier delivery — invoice GC-88214'
                    : kind === 'DAMAGE'
                      ? 'e.g. Crushed in transit'
                      : 'e.g. Physical count correction'
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
              />
              {missingReason && reason.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  Required — this is what the auditor reads.
                </p>
              )}
            </div>

            {validationError && (
              <p className="rounded-md bg-danger-50 px-3 py-2 text-xs font-medium text-danger-800 ring-1 ring-danger-200">
                {validationError}
              </p>
            )}
          </div>

          <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canApply}
              className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              Apply Adjustment
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
