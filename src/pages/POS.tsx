import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CheckoutDrawer } from '../components/CheckoutDrawer'
import { ThermalReceiptModal } from '../components/ThermalReceiptModal'
import { ArrowRightIcon, CloseIcon, MinusIcon, PlusIcon, ScanIcon } from '../components/Icons'
import { useStore } from '../context/StoreContext'
import { OPERATOR_NAMES } from '../data/operators'
import type { CartItem, Product, ProductCategory, Sale, Tender } from '../types/pos'
import { formatNaira } from '../utils/format'
import { round2 } from '../utils/money'
import { STOCK_BADGES, getStockStatus } from '../utils/stock'

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
 * Deliberately generous with its own height: the operator reads name, unit
 * price, quantity and line total at a glance while the customer watches, and a
 * cramped row turns every sale into a squint. The row has three bands — the
 * product, the stepper, and the remove affordance — so a thumb aiming for the
 * steppers cannot land on the delete.
 *
 * The quantity field keeps its own draft string rather than reading straight
 * from the store: committing on every keystroke would fight the operator
 * halfway through typing `120`, clamping `1` and `12` to stock on the way past.
 * The store still owns the clamp — the draft is only re-synced to what the
 * store accepted, so the field can never drift from the truth.
 */
function CartLine({ item, available, onQuantity, onRemove }: CartLineProps) {
  const [draft, setDraft] = useState(String(item.quantity))

  const lineTotal = round2(item.product.sellingPrice * item.quantity)
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
  // disabled button, which is what an operator tapping it means anyway — a
  // quantity of zero *is* "remove this". It is announced by a toast rather than
  // a confirm dialog: a modal would interrupt every correction, and the line is
  // one scan away from coming back.
  const decrease = () => {
    if (item.quantity <= 1) onRemove(item)
    else apply(item.quantity - 1)
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-[15px] font-semibold leading-snug text-slate-800"
            title={item.product.name}
          >
            {item.product.name}
          </p>
          <p className="money mt-1 text-xs text-slate-500">
            {formatNaira(item.product.sellingPrice)} each
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Subtotal
          </p>
          <p className="money text-base font-bold text-slate-900">{formatNaira(lineTotal)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Joined into one bordered group so a thumb cannot land in the gap
            between two separate buttons. Every part is 48px tall. */}
        <div className="flex items-center rounded-lg border border-slate-300 bg-white">
          <button
            type="button"
            onClick={decrease}
            aria-label={
              item.quantity <= 1
                ? `Remove ${item.product.name} from the cart`
                : `Decrease quantity of ${item.product.name}`
            }
            className={`flex h-12 w-12 items-center justify-center rounded-l-lg transition hover:bg-slate-100 ${
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
            className="h-12 w-14 border-x border-slate-200 text-center text-sm font-semibold text-slate-900 tabular-nums outline-none transition focus:bg-brand-50"
          />

          <button
            type="button"
            onClick={() => apply(item.quantity + 1)}
            disabled={atCeiling}
            aria-label={`Increase quantity of ${item.product.name}`}
            className="flex h-12 w-12 items-center justify-center rounded-r-lg text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label={`Remove ${item.product.name} from the cart`}
          className="flex h-12 w-12 items-center justify-center rounded-lg text-slate-400 transition hover:bg-danger-50 hover:text-danger-700"
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
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  /** Remounting the mounted-once drawer gives each cart a clean tender ledger. */
  const [checkoutSession, setCheckoutSession] = useState(0)
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  const scanRef = useRef<HTMLInputElement>(null)
  const cartListRef = useRef<HTMLDivElement>(null)
  const checkoutButtonRef = useRef<HTMLButtonElement>(null)
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

  const handleScan = (event: FormEvent) => {
    event.preventDefault()
    const code = scanInput.trim()
    if (!code) return

    const result = addToCart(code)
    if (result.ok) {
      setScanInput('')
      setCheckoutSession((session) => session + 1)
      notify('success', result.message)
    } else {
      notify('error', result.message)
    }
    focusScanner()
  }

  const handleCardClick = (product: Product) => {
    const result = addToCart(product.id)
    if (result.ok) setCheckoutSession((session) => session + 1)
    else notify('error', result.message)
    focusScanner()
  }

  // A tender is priced against an exact basket. Closing checkout preserves the
  // draft for review, but any actual cart edit starts a fresh tender ledger so
  // money can never leak into a changed sale.
  const handleQuantityChange = (productId: string, quantity: number) => {
    updateCartQuantity(productId, quantity)
    setCheckoutSession((session) => session + 1)
  }

  const handleRemoveLine = (item: CartItem) => {
    removeFromCart(item.product.id)
    setCheckoutSession((session) => session + 1)
    notify('success', `${item.product.name} removed from the cart.`)
    focusScanner()
  }

  const handleClearCart = () => {
    clearCart()
    setCheckoutSession((session) => session + 1)
    setCheckoutOpen(false)
  }

  const handleCheckoutClose = () => {
    setCheckoutOpen(false)
    window.requestAnimationFrame(() => checkoutButtonRef.current?.focus())
  }

  const handleCompleteSale = (payments: Tender[]) => {
    const sale = completeSale(payments, OPERATOR_NAMES[currentRole])
    setCheckoutSession((session) => session + 1)
    setCheckoutOpen(false)
    setReceiptSale(sale)
    setToast(null)
    focusScanner()
  }

  return (
    <>
      {/* Everything except the receipt is suppressed when printing.

          Below `lg` this is a scrolling block: the grid grows to its content
          and the root scrolls it, so the product list and the cart stack into
          one column a phone can read. It is deliberately *not* a flex column —
          a flex item with `min-h-0` shrinks to fit a short viewport instead of
          overflowing, which would quietly clip the cart off a small screen.

          At `lg` the root stops scrolling and the grid becomes a bounded
          two-column board whose panes scroll internally. */}
      <div className="h-full min-h-0 overflow-y-auto print:hidden lg:overflow-hidden">
        <div className="grid min-h-full grid-cols-1 gap-4 p-4 lg:h-full lg:grid-cols-[3fr_2fr] lg:grid-rows-[minmax(0,1fr)]">
          {/* ---------------------------------------------------------- left */}
          <section className="flex min-h-0 flex-col gap-4">
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

            {/* Sized by content on a phone — `flex-none` on purpose, so the
                list grows with the basket up to 70 viewport heights and only
                then scrolls inside itself; a `flex-1` basis of 0 here would
                collapse it against an auto-height parent. Capped so a long
                catalogue cannot push the cart a full screen down the page. At
                `lg` the pane is a fixed-height column again and `flex-1` hands
                it all the leftover height. */}
            <div className="scrollbar-slim max-h-[45dvh] overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
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
            aria-labelledby="current-sale-title"
            className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 id="current-sale-title" className="text-sm font-semibold text-slate-900">
                  Current Sale
                </h2>
                <p className="text-xs text-slate-500 tabular-nums">
                  {cartCount} item{cartCount === 1 ? '' : 's'} · {cart.length} line
                  {cart.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearCart}
                disabled={cart.length === 0}
                className="min-h-11 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Clear Cart
              </button>
            </div>

            {/* A tall band of its own — between 50 and 70 viewport heights — so
                several lines with names, unit prices and subtotals sit on
                screen at once instead of being a scrollbar away. `flex-none` on
                a phone keeps it content-sized within that band (see the product
                list above for why `flex-1` would collapse it); on desktop the
                `flex-1` against a bounded aside keeps the summary and its single
                checkout action directly beneath the scrollable line list. */}
            <div
              ref={cartListRef}
              role="region"
              aria-label="Selected cart items"
              className="scrollbar-slim min-h-[50dvh] max-h-[70dvh] overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1"
            >
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
                      onQuantity={handleQuantityChange}
                      onRemove={handleRemoveLine}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* ---------------------------------------------- checkout summary */}
            {/* Payment starts one deliberate step later: the operator reviews the
                cart, then opens this summary's single forward action. The totals
                stay directly beneath the scrolling line list and never compete
                with tender controls in the main POS view. */}
            <div
              className="shrink-0 border-t border-slate-200 bg-slate-50 p-4"
              aria-labelledby="order-summary-title"
            >
              <h3 id="order-summary-title" className="text-sm font-semibold text-slate-900">
                Order Summary
              </h3>

              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="money font-medium text-slate-800">{formatNaira(cartSubtotal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">VAT (7.5%)</dt>
                  <dd className="money font-medium text-slate-800">{formatNaira(cartVat)}</dd>
                </div>
                <div className="mt-3 flex items-end justify-between gap-4 rounded-lg bg-brand-900 px-4 py-3 text-white shadow-sm">
                  <dt className="flex flex-col text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-200">
                    <span>Grand Total</span>
                    <span className="mt-0.5 text-[11px] font-normal normal-case tracking-normal text-brand-200/70">
                      Including VAT
                    </span>
                  </dt>
                  <dd className="money text-2xl font-bold tracking-tight sm:text-3xl">
                    {formatNaira(cartTotal)}
                  </dd>
                </div>
              </dl>

              <button
                ref={checkoutButtonRef}
                type="button"
                onClick={() => setCheckoutOpen(true)}
                disabled={cartCount === 0}
                aria-haspopup="dialog"
                aria-expanded={checkoutOpen}
                aria-controls="checkout-drawer"
                className="mt-3 flex min-h-14 w-full items-center justify-between gap-3 rounded-lg bg-brand-900 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                <span>Proceed to Checkout</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="money text-xs font-semibold sm:text-sm">
                    {formatNaira(cartTotal)}
                  </span>
                  <ArrowRightIcon className="h-4 w-4" />
                </span>
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

      <CheckoutDrawer
        key={checkoutSession}
        open={checkoutOpen}
        cartCount={cartCount}
        subtotal={cartSubtotal}
        vat={cartVat}
        total={cartTotal}
        onClose={handleCheckoutClose}
        onComplete={handleCompleteSale}
      />

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
