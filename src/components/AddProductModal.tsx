import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useStore } from '../context/StoreContext'
import {
  PRODUCT_CATEGORIES,
  type NewProductInput,
  type Product,
  type ProductCategory,
} from '../types/pos'
import { nextInternalBarcode } from '../utils/barcode'
import { formatNaira } from '../utils/format'
import { SparkIcon } from './Icons'

interface AddProductModalProps {
  onClose: () => void
  /** Fired once the line is committed, so the directory can point at it. */
  onAdded?: (product: Product) => void
}

/** EAN-8 through GTIN-14 — the widths a retail scanner can actually read. */
const BARCODE_PATTERN = /^\d{8,14}$/

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15'
const LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-slate-600'
const HINT_CLASS = 'mt-1 text-xs text-slate-400'

export function AddProductModal({ onClose, onAdded }: AddProductModalProps) {
  const { products, addProduct } = useStore()

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [category, setCategory] = useState<ProductCategory>('Beverages')
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [minStock, setMinStock] = useState('0')
  /** Only ever set by a rejected submit — the store owns the uniqueness rules. */
  const [error, setError] = useState<string | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const selling = Number.parseFloat(sellingPrice)
  const cost = Number.parseFloat(costPrice)
  const units = Number.parseInt(stock, 10)
  const reorder = Number.parseInt(minStock, 10)

  const hasName = name.trim().length > 0
  const hasSku = sku.trim().length > 0
  const hasBarcode = BARCODE_PATTERN.test(barcode)
  const hasSelling = Number.isFinite(selling) && selling > 0
  const hasCost = Number.isFinite(cost) && cost >= 0
  const hasUnits = Number.isInteger(units) && units >= 0
  const hasReorder = Number.isInteger(reorder) && reorder >= 0

  const canSubmit =
    hasName && hasSku && hasBarcode && hasSelling && hasCost && hasUnits && hasReorder

  // Reported only once there is something to contradict — an untouched form
  // should not open with a wall of red.
  let validationError: string | null = null
  if (barcode.length > 0 && !hasBarcode) {
    validationError = 'A barcode is 8 to 14 digits.'
  } else if (sellingPrice.length > 0 && !hasSelling) {
    validationError = 'The selling price must be more than ₦0 — nothing can be sold for free.'
  } else if (costPrice.length > 0 && !hasCost) {
    validationError = 'The cost price cannot be negative.'
  }

  const margin = hasSelling && hasCost ? selling - cost : null
  const marginPercent = margin !== null && selling > 0 ? (margin / selling) * 100 : null
  const belowCost = margin !== null && margin < 0

  const handleGenerateBarcode = () => {
    setBarcode(nextInternalBarcode(products.map((product) => product.barcode)))
    setError(null)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return

    const input: NewProductInput = {
      name: name.trim(),
      sku: sku.trim(),
      barcode,
      category,
      sellingPrice: selling,
      costPrice: cost,
      stock: units,
      minStock: reorder,
    }

    try {
      const product = addProduct(input)
      onAdded?.(product)
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not add the product.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-auto flex min-h-full max-w-2xl items-center justify-center"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add a product to the catalogue"
      >
        <form
          onSubmit={handleSubmit}
          // One delegated handler rather than seven: editing anything clears a
          // rejection, so the banner never outlives the mistake it described.
          onChange={() => setError(null)}
          className="w-full rounded-xl bg-white shadow-2xl ring-1 ring-slate-300"
        >
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Add Product</h2>
              <p className="text-xs text-slate-500">
                Creates a catalogue line and declares its opening stock to the ledger.
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

          <div className="space-y-4 px-5 py-5">
            {/* ------------------------------------------------------- name */}
            <div>
              <label htmlFor="product-name" className={LABEL_CLASS}>
                Product name
              </label>
              <input
                id="product-name"
                ref={nameRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Peak Milk Powder 400g"
                className={FIELD_CLASS}
              />
              {!hasName && name.length === 0 && (
                <p className={HINT_CLASS}>As it should read on the shelf label and receipt.</p>
              )}
            </div>

            {/* ------------------------------------------------ sku / aisle */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="product-sku" className={LABEL_CLASS}>
                  Shelf SKU
                </label>
                <input
                  id="product-sku"
                  value={sku}
                  // Stock codes are upper case by convention throughout the
                  // catalogue, so the field enforces it rather than the report.
                  onChange={(event) => setSku(event.target.value.toUpperCase())}
                  placeholder="DAI-PEA-400"
                  autoComplete="off"
                  className={`${FIELD_CLASS} font-mono uppercase`}
                />
              </div>
              <div>
                <label htmlFor="product-category" className={LABEL_CLASS}>
                  Category
                </label>
                <select
                  id="product-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as ProductCategory)}
                  className={`${FIELD_CLASS} bg-white`}
                >
                  {PRODUCT_CATEGORIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ---------------------------------------------------- barcode */}
            <div>
              <label htmlFor="product-barcode" className={LABEL_CLASS}>
                Barcode
              </label>
              <div className="flex gap-2">
                <input
                  id="product-barcode"
                  inputMode="numeric"
                  autoComplete="off"
                  value={barcode}
                  // Digits only, capped at the longest GTIN: a stray letter or
                  // a pasted space would otherwise sit in the field unnoticed
                  // until the scanner failed to find it.
                  onChange={(event) =>
                    setBarcode(event.target.value.replace(/\D/g, '').slice(0, 14))
                  }
                  placeholder="13-digit EAN, or generate an in-store code"
                  className={`${FIELD_CLASS} font-mono tracking-wide`}
                />
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  title="Allocate the next in-store barcode beginning 200"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-slate-700 transition hover:bg-slate-100"
                >
                  <SparkIcon className="h-3.5 w-3.5" />
                  Generate
                </button>
              </div>
              <p className={HINT_CLASS}>
                In-store codes start <span className="font-mono">200</span> — the GS1 range
                reserved for the store&rsquo;s own labels, so it can never clash with a
                manufacturer&rsquo;s code.
              </p>
            </div>

            {/* ----------------------------------------------------- prices */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="product-cost" className={LABEL_CLASS}>
                  Cost price (₦)
                </label>
                <input
                  id="product-cost"
                  inputMode="decimal"
                  value={costPrice}
                  onChange={(event) => setCostPrice(event.target.value)}
                  placeholder="0.00"
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label htmlFor="product-price" className={LABEL_CLASS}>
                  Selling price (₦)
                </label>
                <input
                  id="product-price"
                  inputMode="decimal"
                  value={sellingPrice}
                  onChange={(event) => setSellingPrice(event.target.value)}
                  placeholder="0.00"
                  className={FIELD_CLASS}
                />
              </div>
            </div>

            {margin !== null && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200">
                <span className="text-slate-500">Margin per unit</span>
                <span className="tabular-nums">
                  <strong
                    className={`font-semibold ${belowCost ? 'text-danger-700' : 'text-slate-900'}`}
                  >
                    {formatNaira(margin)}
                  </strong>
                  {marginPercent !== null && (
                    <span
                      className={`ml-2 text-xs font-medium ${
                        belowCost ? 'text-danger-700' : 'text-success-700'
                      }`}
                    >
                      {marginPercent.toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>
            )}

            {belowCost && (
              <p className="rounded-md bg-warning-50 px-3 py-2 text-xs font-medium text-warning-800 ring-1 ring-warning-200">
                Cost is above the selling price — this line would sell at a loss.
              </p>
            )}

            {/* ------------------------------------------------------ stock */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="product-stock" className={LABEL_CLASS}>
                  Opening stock (units)
                </label>
                <input
                  id="product-stock"
                  inputMode="numeric"
                  value={stock}
                  onChange={(event) => setStock(event.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className={`${FIELD_CLASS} text-right tabular-nums`}
                />
                <p className={HINT_CLASS}>
                  {hasUnits && units > 0
                    ? `${units} unit${units === 1 ? '' : 's'} will be logged as opening stock.`
                    : 'Nothing is logged for a line created at zero.'}
                </p>
              </div>
              <div>
                <label htmlFor="product-min-stock" className={LABEL_CLASS}>
                  Reorder level (units)
                </label>
                <input
                  id="product-min-stock"
                  inputMode="numeric"
                  value={minStock}
                  onChange={(event) => setMinStock(event.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className={`${FIELD_CLASS} text-right tabular-nums`}
                />
                <p className={HINT_CLASS}>
                  At or below this the line is flagged for reorder on the dashboard.
                </p>
              </div>
            </div>

            {(validationError ?? error) && (
              <p className="rounded-md bg-danger-50 px-3 py-2 text-xs font-medium text-danger-800 ring-1 ring-danger-200">
                {validationError ?? error}
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
              disabled={!canSubmit}
              className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              Add Product
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
