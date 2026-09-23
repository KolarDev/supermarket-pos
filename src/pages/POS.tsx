import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ThermalReceiptModal } from '../components/ThermalReceiptModal'
import {
  ArrowRightIcon,
  CartIcon,
  CheckIcon,
  CloseIcon,
  MinusIcon,
  PlusIcon,
  ScanIcon,
} from '../components/Icons'
import { useStore } from '../context/StoreContext'
import { OPERATOR_NAMES } from '../data/operators'
import type { CartItem, PaymentMethod, Product, ProductCategory, Sale, Tender } from '../types/pos'
import { formatNaira } from '../utils/format'
import {
  TENDER_METHODS,
  balanceDue,
  checkoutBanner,
  tenderProblem,
  tenderTotal,
} from '../utils/payments'
import { STOCK_BADGES, getStockStatus } from '../utils/stock'

const TENDER_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  TRANSFER: 'Transfer',
}

/** Common Nigerian banknotes, for one-tap cash entry. */
const QUICK_TENDER = [1000, 5000, 10000, 20000]

/** Every tender field empty. Reused on reset — the fields are replaced, never
 *  mutated, so one frozen object is safe to hand back each time. */
const NO_TENDERS: Record<PaymentMethod, string> = { CASH: '', CARD: '', TRANSFER: '' }

const TOAST_DURATION_MS = 2800

interface Toast {
  id: number
  tone: 'success' | 'error'
  message: string
}

interface CartLineProps {
  item: CartItem
  /** Live stock, so the stepper ceiling tracks a mid-sale adjustment. */
  available: number
  onQuantity: (productId: string, quantity: number) => void
  onRemove: (item: CartItem) => void
}

/**
 * One row of the current sale.
 *
 * The quantity field keeps its own draft string rather than reading straight
 * from the store: committing on every keystroke would fight the operator
 * halfway through typing `120`, clamping `1` and `12` to stock on the way past.
 * The store still owns the clamp — the draft is only re-synced to what the
 * store accepted, so the field can never drift from the truth.
 */
function CartLine({ item, available, onQuantity, onRemove }: CartLineProps) {
  const [draft, setDraft] = useState(String(item.quantity))

  const lineTotal = item.product.sellingPrice * item.quantity
  const atCeiling = item.quantity >= available

  /** Sends a quantity to the store and shows whatever the store accepted. */
  const apply = (next: number) => {
    onQuantity(item.product.id, next)
    setDraft(String(Math.min(Math.max(1, next), Math.max(1, available))))
  }

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10)
    if (!Number.isInteger(parsed) || parsed < 1) {
      setDraft(String(item.quantity))
      return
    }
    apply(parsed)
  }

  // At the last unit the decrement drops the line rather than dead-ending on a
  // disabled button, which is what an operator tapping it means anyway. It is
  // announced by a toast rather than a confirm dialog: a modal would interrupt
  // every correction, and the line is one scan away from coming back.
  const decrease = () => {
    if (item.quantity <= 1) onRemove(item)
    else apply(item.quantity - 1)
  }

  return (
    <li className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800" title={item.product.name}>
            {item.product.name}
          </p>
          <p className="money mt-0.5 text-xs text-slate-500">
            {formatNaira(item.product.sellingPrice)} each
          </p>
        </div>
        <span className="money shrink-0 text-sm font-semibold text-slate-900">
          {formatNaira(lineTotal)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Joined into one bordered group so a thumb cannot land in the gap
            between two separate buttons. Every part is 44px tall. */}
        <div className="flex items-center rounded-lg border border-slate-300 bg-white">
          <button
            type="button"
            onClick={decrease}
            aria-label={
              item.quantity <= 1
                ? `Remove ${item.product.name} from the cart`
                : `Decrease quantity of ${item.product.name}`
            }
            className={`flex h-11 w-11 items-center justify-center rounded-l-lg transition hover:bg-slate-100 ${
              item.quantity <= 1 ? 'text-danger-700' : 'text-slate-700'
            }`}
          >
            <MinusIcon className="h-4 w-4" />
          </button>

          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/\D/g, '').slice(0, 5))}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitDraft()
              }
            }}
            inputMode="numeric"
            aria-label={`Quantity of ${item.product.name}`}
            className="h-11 w-12 border-x border-slate-200 text-center text-sm font-semibold text-slate-900 tabular-nums outline-none transition focus:bg-brand-50"
          />

          <button
            type="button"
            onClick={() => apply(item.quantity + 1)}
            disabled={atCeiling}
            aria-label={`Increase quantity of ${item.product.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-r-lg text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label={`Remove ${item.product.name} from the cart`}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-danger-50 hover:text-danger-700"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
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
  /** Below `lg` the grid and the cart take turns; at `lg` both are always on. */
  const [tab, setTab] = useState<'products' | 'cart'>('products')
  const [tenders, setTenders] = useState<Record<PaymentMethod, string>>(NO_TENDERS)
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  const scanRef = useRef<HTMLInputElement>(null)
  const cartListRef = useRef<HTMLDivElement>(null)
  const toastIdRef = useRef(0)

  // A scanner gun is just a keyboard: the field must already hold focus when
  // the trigger is pulled, otherwise the digits land nowhere. Skipped on a
  // phone, where there is no gun and focusing the field would throw the soft
  // keyboard over half the screen before anyone asked for it.
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) scanRef.current?.focus()
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

  // New lines land at the bottom of the list, and on a phone the pane is short
  // enough that the one just scanned could sit below the fold.
  useEffect(() => {
    const list = cartListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [cart.length])

  // ------------------------------------------------------------- tender maths
  // Every figure below comes from `utils/payments`, the same module the store
  // validates with — so the button can never be enabled for a sale the store
  // would refuse, nor disabled for one it would take.
  const payments = useMemo<Tender[]>(
    () =>
      TENDER_METHODS.map((method) => ({
        method,
        amount: Number.parseFloat(tenders[method]) || 0,
      })),
    [tenders],
  )

  const paid = tenderTotal(payments)
  const due = balanceDue(payments, cartTotal)
  const problem = cartCount > 0 ? tenderProblem(payments, cartTotal) : null
  /** The one line the panel shows about where the sale stands. */
  const banner = cartCount > 0 ? checkoutBanner(payments, cartTotal) : null
  const canComplete = cartCount > 0 && problem === null
  const paidPercent = cartTotal > 0 ? Math.min(100, (paid / cartTotal) * 100) : 0

  const setTender = (method: PaymentMethod, value: string) =>
    setTenders((prev) => ({ ...prev, [method]: value }))

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

  const handleRemoveLine = (item: CartItem) => {
    removeFromCart(item.product.id)
    notify('success', `${item.product.name} removed from the cart.`)
    focusScanner()
  }

  const resetCheckout = () => setTenders(NO_TENDERS)

  const handleCompleteSale = () => {
    try {
      const sale = completeSale(payments, OPERATOR_NAMES[currentRole])
      setReceiptSale(sale)
      resetCheckout()
      setToast(null)
      // Back to the grid, so the next customer's first scan has somewhere to
      // land once the receipt is dismissed.
      setTab('products')
      focusScanner()
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Could not complete the sale.')
    }
  }

  return (
    <>
      {/* Everything except the receipt is suppressed when printing. */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden print:hidden">
        {/* ------------------------------------------------ mobile tab switch */}
        {/* Below `lg` the grid and the cart cannot share the width, and a cart
            parked under a long product list is a screenful of scrolling away
            from the scan field. One pane at a time, with the unit count on the
            tab so the cart can be seen filling from across the shop. */}
        <div className="shrink-0 px-4 pt-4 lg:hidden">
          <div
            role="group"
            aria-label="Register view"
            className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200 p-1"
          >
            <button
              type="button"
              aria-pressed={tab === 'products'}
              onClick={() => setTab('products')}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold transition ${
                tab === 'products'
                  ? 'bg-brand-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ScanIcon className="h-4 w-4" />
              Products
            </button>
            <button
              type="button"
              aria-pressed={tab === 'cart'}
              onClick={() => setTab('cart')}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold transition ${
                tab === 'cart'
                  ? 'bg-brand-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CartIcon className="h-4 w-4" />
              Cart
              {cartCount > 0 && (
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${
                    tab === 'cart' ? 'bg-white text-brand-900' : 'bg-brand-900 text-white'
                  }`}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 p-4 lg:grid-cols-[3fr_2fr]">
          {/* ---------------------------------------------------------- left */}
          <section
            className={`${
              tab === 'products' ? 'flex' : 'hidden'
            } min-h-0 flex-col gap-4 lg:flex`}
          >
            <form onSubmit={handleScan} className="shrink-0">
              <div className="relative">
                <ScanIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={scanRef}
                  value={scanInput}
                  onChange={(event) => setScanInput(event.target.value)}
                  placeholder="Scan barcode or type SKU, then press Enter…"
                  aria-label="Scan or search products"
                  autoComplete="off"
                  className="min-h-12 w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
                />
              </div>
            </form>

            <div className="flex shrink-0 flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`min-h-9 rounded-full px-3.5 text-xs font-medium ring-1 transition ${
                    activeCategory === category
                      ? 'bg-brand-900 text-white ring-brand-900'
                      : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
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
                          className="relative flex h-full min-h-24 w-full flex-col items-start gap-2 rounded-lg border border-slate-200 bg-white p-3.5 text-left shadow-sm transition enabled:hover:border-brand-900/40 enabled:hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
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
          <aside
            className={`${
              tab === 'cart' ? 'flex' : 'hidden'
            } min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:flex`}
          >
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
                className="min-h-11 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Clear Cart
              </button>
            </div>

            {/* `flex-1` against a bounded aside is what pins the payment panel
                to the bottom: the lines scroll, the totals and the Complete
                Sale button never move. */}
            <div ref={cartListRef} className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">
                  Cart is empty. Scan an item or tap a product to begin.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {cart.map((item) => (
                    <CartLine
                      key={item.product.id}
                      item={item}
                      available={stockById.get(item.product.id) ?? item.product.stock}
                      onQuantity={updateCartQuantity}
                      onRemove={handleRemoveLine}
                    />
                  ))}
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

              {cartCount > 0 && (
                <>
                  {/* ------------------------------------- running tender total */}
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-600">Total paid</span>
                      <span className="money tabular-nums text-slate-500">
                        {formatNaira(paid)} of {formatNaira(cartTotal)}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Share of the bill tendered"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(paidPercent)}
                      className="h-1.5 overflow-hidden rounded-full bg-slate-200"
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-200 ${
                          // Amber while the bill is still short, green once the
                          // drawer has enough to settle it.
                          due < 0 ? 'bg-warning-500' : 'bg-success-600'
                        }`}
                        style={{ width: `${paidPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* -------------------------------- split across the three tenders */}
                  <div className="grid grid-cols-3 gap-2">
                    {TENDER_METHODS.map((method) => (
                      <div key={method}>
                        <label
                          htmlFor={`tender-${method}`}
                          className="mb-1 block text-[11px] font-medium text-slate-600"
                        >
                          {TENDER_LABELS[method]}
                        </label>
                        <input
                          id={`tender-${method}`}
                          inputMode="decimal"
                          autoComplete="off"
                          value={tenders[method]}
                          onChange={(event) => setTender(method, event.target.value)}
                          placeholder="0.00"
                          className="money min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-right text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {QUICK_TENDER.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setTender('CASH', String(amount))}
                        className="min-h-11 rounded-md border border-slate-300 bg-white px-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        {formatNaira(amount)}
                      </button>
                    ))}
                  </div>

                  {/* ------------------------------- where the sale stands, in one line */}
                  {/* Every branch below comes from `checkoutBanner`, which owns
                      the sign of the balance so the panel cannot read an
                      overpayment as money still owed. */}
                  {banner?.kind === 'DUE' && (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-danger-50 px-3 py-2 text-xs font-medium text-danger-800 ring-1 ring-danger-200">
                      <span>Remaining balance due</span>
                      <span className="money text-sm font-semibold">
                        {formatNaira(banner.amount)}
                      </span>
                    </div>
                  )}

                  {/* Settled, but the drawer cannot make the change — the rule
                      gets its own wording rather than "Change due", which would
                      read as success on a card tender that can never produce it. */}
                  {banner?.kind === 'BLOCKED' && (
                    <p className="rounded-md bg-danger-50 px-3 py-2 text-xs font-medium text-danger-800 ring-1 ring-danger-200">
                      {banner.message}
                    </p>
                  )}

                  {banner?.kind === 'CHANGE' && (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-success-50 px-3 py-2 text-xs font-medium text-success-800 ring-1 ring-success-200">
                      <span>Change due</span>
                      <span className="money text-sm font-semibold">
                        {formatNaira(banner.amount)}
                      </span>
                    </div>
                  )}

                  {banner?.kind === 'EXACT' && (
                    <div className="flex items-center gap-1.5 rounded-md bg-success-50 px-3 py-2 text-xs font-medium text-success-800 ring-1 ring-success-200">
                      <CheckIcon className="h-4 w-4 shrink-0" />
                      Exact amount tendered.
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={!canComplete}
                className="min-h-12 w-full rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                Complete Sale · {formatNaira(cartTotal)}
              </button>
            </div>
          </aside>
        </div>

        {/* ------------------------------------------------- mobile review bar */}
        {/* Pinned by the shell's flex layout rather than `sticky` — the shell is
            viewport-locked, so a `shrink-0` last child is always on screen. */}
        {tab === 'products' && cartCount > 0 && (
          <div className="shrink-0 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_12px_rgba(15,23,42,0.08)] lg:hidden">
            <button
              type="button"
              onClick={() => setTab('cart')}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              <span className="flex items-center gap-2">
                <CartIcon className="h-4 w-4" />
                {cartCount} item{cartCount === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-2">
                <span className="money tabular-nums">{formatNaira(cartTotal)}</span>
                Review &amp; pay
                <ArrowRightIcon className="h-4 w-4" />
              </span>
            </button>
          </div>
        )}
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
