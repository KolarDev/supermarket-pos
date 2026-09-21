import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ThermalReceiptModal } from '../components/ThermalReceiptModal'
import { useStore } from '../context/StoreContext'
import { OPERATOR_NAMES } from '../data/operators'
import type { PaymentMethod, Product, ProductCategory, Sale } from '../types/pos'
import { formatNaira } from '../utils/format'
import { STOCK_BADGES, getStockStatus } from '../utils/stock'

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER']

/** Common Nigerian banknotes, for one-tap tender entry. */
const QUICK_TENDER = [1000, 5000, 10000, 20000]

const TOAST_DURATION_MS = 2800

interface Toast {
  id: number
  tone: 'success' | 'error'
  message: string
}

export default function POS() {
  const {
    products,
    cart,
    currentRole,
    cartCount,
    cartSubtotal,
    cartVat,
    cartTotal,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    completeSale,
  } = useStore()

  const [scanInput, setScanInput] = useState('')
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'All'>('All')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [tenderInput, setTenderInput] = useState('')
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  const scanRef = useRef<HTMLInputElement>(null)
  const toastIdRef = useRef(0)

  // A scanner gun is just a keyboard: the field must already hold focus when
  // the trigger is pulled, otherwise the digits land nowhere.
  useEffect(() => {
    scanRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const notify = (tone: Toast['tone'], message: string) => {
    toastIdRef.current += 1
    setToast({ id: toastIdRef.current, tone, message })
  }

  const focusScanner = () => scanRef.current?.focus()

  /** Live stock keyed by id, so steppers and cards read current levels. */
  const stockById = useMemo(
    () => new Map(products.map((product) => [product.id, product.stock])),
    [products],
  )

  const categories = useMemo<(ProductCategory | 'All')[]>(() => {
    const seen = new Set<ProductCategory>()
    for (const product of products) {
      if (product.active) seen.add(product.category)
    }
    return ['All', ...Array.from(seen).sort()]
  }, [products])

  const unitCountById = useMemo(
    () => new Map(cart.map((item) => [item.product.id, item.quantity])),
    [cart],
  )

  // The scan field doubles as a filter: typing a partial barcode narrows the
  // grid so the operator can confirm what they are about to ring up.
  const visibleProducts = useMemo(() => {
    const query = scanInput.trim().toLowerCase()
    return products.filter((product) => {
      if (!product.active) return false
      if (activeCategory !== 'All' && product.category !== activeCategory) return false
      if (!query) return true
      return (
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.barcode.includes(query)
      )
    })
  }, [products, activeCategory, scanInput])

  const amountReceived = Math.max(0, Number.parseFloat(tenderInput) || 0)
  const isCash = paymentMethod === 'CASH'
  const changeDue = amountReceived - cartTotal
  const isShortTender = isCash && amountReceived > 0 && changeDue < 0

  const canComplete =
    cartCount > 0 && (!isCash || (amountReceived > 0 && amountReceived >= cartTotal))

  const handleScan = (event: FormEvent) => {
    event.preventDefault()
    const code = scanInput.trim()
    if (!code) return

    const result = addToCart(code)
    if (result.ok) {
      setScanInput('')
      notify('success', result.message)
    } else {
      notify('error', result.message)
    }
    focusScanner()
  }

  const handleCardClick = (product: Product) => {
    const result = addToCart(product.id)
    if (!result.ok) notify('error', result.message)
    focusScanner()
  }

  const resetCheckout = () => {
    setTenderInput('')
    setPaymentMethod('CASH')
  }

  const handleCompleteSale = () => {
    try {
      // CARD and TRANSFER settle for the exact total — no cash is tendered, so
      // no change is due and `completeSale` would otherwise reject the sale.
      const tender = isCash ? amountReceived : cartTotal
      const sale = completeSale(paymentMethod, tender, OPERATOR_NAMES[currentRole])
      setReceiptSale(sale)
      resetCheckout()
      setToast(null)
      focusScanner()
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Could not complete the sale.')
    }
  }

  return (
    <>
      {/* Everything except the receipt is suppressed when printing. */}
      <div className="flex min-h-screen flex-col lg:h-full lg:min-h-0 lg:overflow-hidden print:hidden">
        <div className="grid flex-1 gap-4 p-4 lg:min-h-0 lg:grid-cols-[3fr_2fr]">
          {/* ---------------------------------------------------------- left */}
          <section className="flex flex-col gap-4 lg:min-h-0">
            <form onSubmit={handleScan} className="shrink-0">
              <div className="relative">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                >
                  {/* USB barcode scanner */}
                  <path d="M4 5v14M7 5v14M10.5 5v14M14 5v14M17 5v14M20 5v14" />
                </svg>
                <input
                  ref={scanRef}
                  value={scanInput}
                  onChange={(event) => setScanInput(event.target.value)}
                  placeholder="Scan barcode or type SKU, then press Enter…"
                  aria-label="Scan or search products"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
                />
              </div>
            </form>

            <div className="flex shrink-0 flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 transition ${
                    activeCategory === category
                      ? 'bg-brand-900 text-white ring-brand-900'
                      : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="scrollbar-slim lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {visibleProducts.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-4 py-10 text-center text-sm text-slate-500">
                  No products match “{scanInput.trim()}”. Press Enter to scan, or clear the field.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleProducts.map((product) => {
                    const status = getStockStatus(product)
                    const badge = STOCK_BADGES[status]
                    const sold = status === 'OUT_OF_STOCK'
                    const inCart = unitCountById.get(product.id) ?? 0
                    return (
                      <li key={product.id}>
                        <button
                          type="button"
                          disabled={sold}
                          onClick={() => handleCardClick(product)}
                          className="relative flex h-full w-full flex-col items-start gap-2 rounded-lg border border-slate-200 bg-white p-3.5 text-left shadow-sm transition enabled:hover:border-brand-900/40 enabled:hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {inCart > 0 && (
                            <span className="absolute right-2.5 top-2.5 rounded-full bg-brand-900 px-2 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                              {inCart} in cart
                            </span>
                          )}
                          <span className="pr-16 text-sm font-medium leading-snug text-slate-900">
                            {product.name}
                          </span>
                          <span className="money text-lg font-semibold text-slate-900">
                            {formatNaira(product.sellingPrice)}
                          </span>
                          <span className="mt-auto flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              {product.category}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* --------------------------------------------------------- right */}
          <aside className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:min-h-0">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Current Sale</h2>
                <p className="text-xs text-slate-500 tabular-nums">
                  {cartCount} item{cartCount === 1 ? '' : 's'} · {cart.length} line
                  {cart.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={clearCart}
                disabled={cart.length === 0}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Clear Cart
              </button>
            </div>

            <div className="scrollbar-slim max-h-64 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
              {cart.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">
                  Cart is empty. Scan an item or tap a product to begin.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {cart.map((item) => {
                    const lineTotal = item.product.sellingPrice * item.quantity
                    const ceiling = stockById.get(item.product.id) ?? item.product.stock
                    return (
                      <li key={item.product.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {item.product.name}
                          </p>
                          <p className="money text-xs text-slate-500">
                            {formatNaira(item.product.sellingPrice)} each
                          </p>
                          <div className="mt-2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateCartQuantity(item.product.id, item.quantity - 1)
                              }
                              disabled={item.quantity <= 1}
                              aria-label={`Decrease quantity of ${item.product.name}`}
                              className="h-7 w-7 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm font-semibold text-slate-900 tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateCartQuantity(item.product.id, item.quantity + 1)
                              }
                              disabled={item.quantity >= ceiling}
                              aria-label={`Increase quantity of ${item.product.name}`}
                              className="h-7 w-7 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="money text-sm font-semibold text-slate-900">
                            {formatNaira(lineTotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            aria-label={`Remove ${item.product.name}`}
                            className="rounded-md px-1.5 py-0.5 text-xs font-medium text-danger-700 transition hover:bg-danger-50"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="shrink-0 space-y-3 border-t border-slate-200 bg-slate-50 px-4 py-4">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="money text-slate-800">{formatNaira(cartSubtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">VAT (7.5%)</dt>
                  <dd className="money text-slate-800">{formatNaira(cartVat)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
                  <dt className="text-base font-semibold text-slate-900">Total</dt>
                  <dd className="money text-2xl font-bold text-slate-900">
                    {formatNaira(cartTotal)}
                  </dd>
                </div>
              </dl>

              <div
                role="group"
                aria-label="Payment method"
                className="grid grid-cols-3 gap-1 rounded-lg bg-slate-200 p-1"
              >
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    aria-pressed={paymentMethod === method}
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                      paymentMethod === method
                        ? 'bg-brand-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {isCash && (
                <div className="space-y-2">
                  <label
                    htmlFor="tender"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Amount Received (₦)
                  </label>
                  <input
                    id="tender"
                    inputMode="decimal"
                    value={tenderInput}
                    onChange={(event) => setTenderInput(event.target.value)}
                    placeholder="0.00"
                    className={`money w-full rounded-lg border bg-white px-3 py-2.5 text-right text-base font-semibold outline-none transition focus:ring-2 ${
                      isShortTender
                        ? 'border-danger-500 text-danger-800 focus:border-danger-600 focus:ring-danger-500/20'
                        : 'border-slate-300 text-slate-900 focus:border-brand-900 focus:ring-brand-900/15'
                    }`}
                  />

                  <div className="grid grid-cols-4 gap-1.5">
                    {QUICK_TENDER.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setTenderInput(String(amount))}
                        className="rounded-md border border-slate-300 bg-white px-1 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        {formatNaira(amount)}
                      </button>
                    ))}
                  </div>

                  {isShortTender ? (
                    <p className="flex items-center justify-between rounded-md bg-danger-50 px-3 py-2 text-xs font-medium text-danger-800 ring-1 ring-danger-200">
                      <span>Short by</span>
                      <span className="money font-semibold">{formatNaira(-changeDue)}</span>
                    </p>
                  ) : (
                    <p className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      <span>Change Due (₦)</span>
                      <span className="money text-sm font-semibold text-slate-900">
                        {formatNaira(Math.max(0, changeDue))}
                      </span>
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={!canComplete}
                className="w-full rounded-lg bg-brand-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                Complete Sale · {formatNaira(cartTotal)}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-4 z-[60] w-[min(92vw,26rem)] -translate-x-1/2 print:hidden"
        >
          <p
            className={`rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ring-1 ${
              toast.tone === 'success'
                ? 'bg-success-50 text-success-800 ring-success-200'
                : 'bg-danger-50 text-danger-800 ring-danger-200'
            }`}
          >
            {toast.message}
          </p>
        </div>
      )}

      <ThermalReceiptModal
        sale={receiptSale}
        onClose={() => {
          setReceiptSale(null)
          focusScanner()
        }}
      />
    </>
  )
}
