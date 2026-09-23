import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { INITIAL_MOVEMENTS, INITIAL_PRODUCTS, INITIAL_SALES } from '../data/mockData'
import { getOperatorName } from '../data/operators'
import type {
  AddToCartResult,
  CartItem,
  NewProductInput,
  Product,
  Sale,
  StockMovement,
  StockMovementType,
  Tender,
  UserRole,
} from '../types/pos'
import { priceLines, round2 } from '../utils/money'
import {
  normaliseTenders,
  settlementOf,
  tenderProblem,
  tenderTotal,
} from '../utils/payments'

/**
 * Bumped from v1 when the seeded sales history landed. A browser holding v1
 * state would otherwise boot into a dashboard with no trade on it, and the
 * operator would have to know to press Reset.
 *
 * Bumped again to v3 for split payments: a `Sale` now carries a list of tenders
 * plus a `settlement` summary, so a v2 payload read back would render a receipt
 * with no payment lines on it. The version in the key is what retires it.
 */
const STORAGE_KEY = 'supermarket-pos.state.v3'
/** Receipts are sequential from here so the first demo receipt reads REC-10023. */
const FIRST_RECEIPT_SEQUENCE = 10023

let idCounter = 0
/** Short, collision-resistant ids for rows created during the session. */
const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${(idCounter++).toString(36)}`

/**
 * Allocates the next catalogue id by continuing the `PRD-0nn` series that is
 * already there, rather than counting the array — a product retired from the
 * middle of the list would otherwise hand a live line someone else's id.
 */
function nextProductId(products: readonly Product[]): string {
  const highest = products.reduce((max, product) => {
    const match = /^PRD-(\d+)$/.exec(product.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `PRD-${String(highest + 1).padStart(3, '0')}`
}

interface PersistedState {
  products: Product[]
  cart: CartItem[]
  movements: StockMovement[]
  sales: Sale[]
  receiptSequence: number
  currentRole: UserRole
  isOffline: boolean
}

const seedState = (): PersistedState => ({
  products: INITIAL_PRODUCTS,
  cart: [],
  movements: INITIAL_MOVEMENTS,
  sales: INITIAL_SALES,
  receiptSequence: FIRST_RECEIPT_SEQUENCE,
  currentRole: 'Cashier',
  isOffline: false,
})

/**
 * Reads the last session back out of localStorage. Every field is validated
 * and falls back to seed data independently, so a payload written by an older
 * build degrades gracefully instead of crashing the till on boot.
 */
function loadState(): PersistedState {
  const fallback = seedState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      products:
        Array.isArray(parsed.products) && parsed.products.length > 0
          ? parsed.products
          : fallback.products,
      cart: Array.isArray(parsed.cart) ? parsed.cart : fallback.cart,
      movements: Array.isArray(parsed.movements) ? parsed.movements : fallback.movements,
      sales: Array.isArray(parsed.sales) ? parsed.sales : fallback.sales,
      receiptSequence:
        typeof parsed.receiptSequence === 'number'
          ? parsed.receiptSequence
          : fallback.receiptSequence,
      currentRole: parsed.currentRole === 'Manager' ? 'Manager' : 'Cashier',
      isOffline: parsed.isOffline === true,
    }
  } catch {
    // Corrupt JSON, or storage blocked entirely (private mode / quota exceeded).
    return fallback
  }
}

export interface StoreContextValue {
  products: Product[]
  cart: CartItem[]
  movements: StockMovement[]
  sales: Sale[]
  /** Drives the offline banner and the "queued for sync" affordance. */
  isOffline: boolean
  currentRole: UserRole

  /** Units in the cart, not lines — what the customer is actually buying. */
  cartCount: number
  cartSubtotal: number
  cartVat: number
  cartTotal: number

  /** Accepts a scanned barcode, a shelf SKU, or an internal product id. */
  addToCart: (barcodeOrSkuOrId: string) => AddToCartResult
  /** Clamped to 1..current stock; use `removeFromCart` to drop the line. */
  updateCartQuantity: (productId: string, quantity: number) => void
  removeFromCart: (productId: string) => void
  clearCart: () => void
  /**
   * Rings up the cart: writes the sale, decrements stock, logs a SALE movement
   * per line, clears the cart and returns the completed `Sale`.
   *
   * `payments` is one entry per tender, so a bill may be split across cash,
   * card and transfer. Empty and zero entries are discarded; the sale's single
   * `settlement` badge is derived from what is left.
   *
   * Throws on an empty cart, on nothing tendered, on a short tender, and on
   * change that the cash portion could not cover — callers should validate
   * against `tenderProblem` first and surface the message to the operator.
   */
  completeSale: (payments: Tender[], cashierName: string) => Sale
  /**
   * Manual correction, delivery or write-off. Throws if the product id is
   * unknown. `type` defaults to ADJUSTMENT but callers should pass the real
   * reason — PURCHASE and DAMAGE drive the colour coding in the audit ledger.
   */
  adjustStock: (
    productId: string,
    delta: number,
    reason: string,
    type?: StockMovementType,
  ) => void
  /**
   * Adds a catalogue line and returns it. Opening stock is declared to the
   * ledger as an OPENING_STOCK movement when the count is above zero.
   *
   * Throws if the name is blank, or if the barcode or SKU is already in use —
   * a scanner resolves a code to the first match, so a duplicate would quietly
   * ring up the wrong product. Callers should surface the message.
   */
  addProduct: (input: NewProductInput) => Product
  toggleOfflineMode: () => void
  switchRole: (role: UserRole) => void
  /**
   * Puts the seeded catalogue, ledger and sales history back. The demo data is
   * dated relative to the day it was seeded, so a browser that has been holding
   * this state for a week needs this to get today's numbers back on the
   * dashboard. Discards everything rung up in the current session.
   */
  resetDemoData: () => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  // `loadState` is passed as an initialiser so localStorage is touched once,
  // on mount, rather than on every render.
  const [boot] = useState(loadState)
  const [products, setProducts] = useState<Product[]>(boot.products)
  const [cart, setCart] = useState<CartItem[]>(boot.cart)
  const [movements, setMovements] = useState<StockMovement[]>(boot.movements)
  const [sales, setSales] = useState<Sale[]>(boot.sales)
  const [receiptSequence, setReceiptSequence] = useState(boot.receiptSequence)
  const [isOffline, setIsOffline] = useState(boot.isOffline)
  const [currentRole, setCurrentRole] = useState<UserRole>(boot.currentRole)

  useEffect(() => {
    const snapshot: PersistedState = {
      products,
      cart,
      movements,
      sales,
      receiptSequence,
      currentRole,
      isOffline,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // Storage full or unavailable — the session keeps working in memory.
    }
  }, [products, cart, movements, sales, receiptSequence, currentRole, isOffline])

  const totals = useMemo(() => {
    const { subtotal, vat, total } = priceLines(
      cart.map((item) => ({ unitPrice: item.product.sellingPrice, quantity: item.quantity })),
    )
    return {
      count: cart.reduce((units, item) => units + item.quantity, 0),
      subtotal,
      vat,
      total,
    }
  }, [cart])

  const addToCart = useCallback(
    (barcodeOrSkuOrId: string): AddToCartResult => {
      const query = barcodeOrSkuOrId.trim().toLowerCase()
      if (!query) return { ok: false, message: 'Scan or type a barcode to add an item.' }

      const product = products.find(
        (candidate) =>
          candidate.barcode.toLowerCase() === query ||
          candidate.sku.toLowerCase() === query ||
          candidate.id.toLowerCase() === query,
      )

      if (!product) {
        return { ok: false, message: `No product matches “${barcodeOrSkuOrId.trim()}”.` }
      }
      if (!product.active) {
        return { ok: false, message: `${product.name} has been discontinued.` }
      }
      if (product.stock <= 0) {
        return { ok: false, message: `${product.name} is out of stock.` }
      }

      const alreadyInCart = cart.find((item) => item.product.id === product.id)?.quantity ?? 0
      if (alreadyInCart >= product.stock) {
        return {
          ok: false,
          message: `Only ${product.stock} in stock — cart already holds ${alreadyInCart}.`,
        }
      }

      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id)
        if (!existing) return [...prev, { product, quantity: 1 }]
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      })

      return { ok: true, message: `${product.name} added.`, product }
    },
    [cart, products],
  )

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.product.id !== productId) return item
          // Prefer live stock over the scan-time snapshot so a mid-sale stock
          // adjustment can't leave the cart over-committed.
          const live = products.find((candidate) => candidate.id === productId)
          const ceiling = Math.max(1, live?.stock ?? item.product.stock)
          const next = Math.min(Math.max(1, Math.trunc(quantity)), ceiling)
          return next === item.quantity ? item : { ...item, quantity: next }
        }),
      )
    },
    [products],
  )

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  const completeSale = useCallback(
    (payments: Tender[], cashierName: string): Sale => {
      if (cart.length === 0) {
        throw new Error('Cannot complete a sale with an empty cart.')
      }

      const subtotalLines = cart.map((item) => ({
        unitPrice: item.product.sellingPrice,
        quantity: item.quantity,
      }))
      // No discount UI yet — the field exists so Sale rows stay forward-compatible.
      const discount = 0
      const { subtotal, vat, total } = priceLines(subtotalLines, discount)

      // The panel validates with this same function, so anything it let through
      // is a bug rather than a message the operator could act on.
      const problem = tenderProblem(payments, total)
      if (problem) throw new Error(problem)

      const tenders = normaliseTenders(payments)
      const amountReceived = tenderTotal(tenders)

      const timestamp = new Date().toISOString()
      const receiptNumber = `REC-${receiptSequence}`

      const sale: Sale = {
        id: makeId('SALE'),
        receiptNumber,
        items: cart.map((item) => ({ ...item })),
        subtotal,
        vat,
        discount,
        total,
        payments: tenders,
        settlement: settlementOf(tenders),
        amountReceived,
        change: round2(amountReceived - total),
        cashier: cashierName,
        timestamp,
      }

      const saleMovements: StockMovement[] = cart.map((item) => ({
        id: makeId('MV'),
        productId: item.product.id,
        productName: item.product.name,
        type: 'SALE',
        quantityDelta: -item.quantity,
        reason: `Sold on receipt ${receiptNumber}`,
        user: cashierName,
        timestamp,
      }))

      setProducts((prev) =>
        prev.map((product) => {
          const line = cart.find((item) => item.product.id === product.id)
          if (!line) return product
          return { ...product, stock: Math.max(0, product.stock - line.quantity) }
        }),
      )
      setMovements((prev) => [...saleMovements, ...prev])
      setSales((prev) => [sale, ...prev])
      setReceiptSequence((prev) => prev + 1)
      setCart([])

      return sale
    },
    [cart, receiptSequence],
  )

  const adjustStock = useCallback(
    (productId: string, delta: number, reason: string, type: StockMovementType = 'ADJUSTMENT') => {
      const product = products.find((candidate) => candidate.id === productId)
      if (!product) throw new Error(`Unknown product: ${productId}`)
      if (!Number.isFinite(delta) || delta === 0) return

      const movement: StockMovement = {
        id: makeId('MV'),
        productId,
        productName: product.name,
        type,
        quantityDelta: delta,
        reason,
        // Record the operator, not the role — the seeded ledger stores names,
        // and a column mixing "Manager" with "Emeka Balogun" reads as broken.
        user: getOperatorName(currentRole),
        timestamp: new Date().toISOString(),
      }

      setProducts((prev) =>
        prev.map((candidate) =>
          candidate.id === productId
            ? { ...candidate, stock: Math.max(0, candidate.stock + delta) }
            : candidate,
        ),
      )
      setMovements((prev) => [movement, ...prev])
    },
    [currentRole, products],
  )

  const addProduct = useCallback(
    (input: NewProductInput): Product => {
      const name = input.name.trim()
      const sku = input.sku.trim()
      const barcode = input.barcode.trim()

      if (!name) throw new Error('A product needs a name.')

      // A duplicate name is a nuisance; a duplicate code is a wrong sale. The
      // till resolves a scan to the first match, so these two fields must be
      // unique across the catalogue for the register to be trustworthy.
      const clash = products.find(
        (product) =>
          product.barcode === barcode || product.sku.trim().toLowerCase() === sku.toLowerCase(),
      )
      if (clash) {
        throw new Error(
          clash.barcode === barcode
            ? `Barcode ${barcode} is already on ${clash.name}.`
            : `SKU ${sku} is already on ${clash.name}.`,
        )
      }

      // The store is the last line of defence: a NaN price or a fractional unit
      // count would spread silently through every total, valuation and margin
      // that reads it, so both are normalised on the way in.
      const money = (value: number) => (Number.isFinite(value) ? round2(Math.max(0, value)) : 0)
      const units = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0)

      const product: Product = {
        id: nextProductId(products),
        name,
        sku,
        barcode,
        category: input.category,
        sellingPrice: money(input.sellingPrice),
        costPrice: money(input.costPrice),
        stock: units(input.stock),
        minStock: units(input.minStock),
        // Nothing renders `image` yet; the field stays on the type so real
        // photography can be dropped into `public/products/` later.
        image: '',
        active: true,
      }

      setProducts((prev) => [...prev, product])

      // Only a line that opens with units has anything to declare. A movement
      // of zero would be noise in the audit trail.
      if (product.stock > 0) {
        const opening: StockMovement = {
          id: makeId('MV'),
          productId: product.id,
          productName: product.name,
          type: 'OPENING_STOCK',
          quantityDelta: product.stock,
          reason: 'Opening stock — product created',
          user: getOperatorName(currentRole),
          timestamp: new Date().toISOString(),
        }
        setMovements((prev) => [opening, ...prev])
      }

      return product
    },
    [currentRole, products],
  )

  const toggleOfflineMode = useCallback(() => setIsOffline((prev) => !prev), [])
  const switchRole = useCallback((role: UserRole) => setCurrentRole(role), [])

  const resetDemoData = useCallback(() => {
    const fresh = seedState()
    setProducts(fresh.products)
    setCart(fresh.cart)
    setMovements(fresh.movements)
    setSales(fresh.sales)
    setReceiptSequence(fresh.receiptSequence)
    setCurrentRole(fresh.currentRole)
    setIsOffline(fresh.isOffline)
  }, [])

  const value = useMemo<StoreContextValue>(
    () => ({
      products,
      cart,
      movements,
      sales,
      isOffline,
      currentRole,
      cartCount: totals.count,
      cartSubtotal: totals.subtotal,
      cartVat: totals.vat,
      cartTotal: totals.total,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      completeSale,
      adjustStock,
      addProduct,
      toggleOfflineMode,
      switchRole,
      resetDemoData,
    }),
    [
      products,
      cart,
      movements,
      sales,
      isOffline,
      currentRole,
      totals,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      completeSale,
      adjustStock,
      addProduct,
      toggleOfflineMode,
      switchRole,
      resetDemoData,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// The hook is intentionally co-located with its provider so consumers have a
// single import site. The trade-off is that this module no longer exports only
// components, which opts it out of Fast Refresh — an accepted cost here, since
// editing the provider restarts the app cleanly regardless.
// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreContextValue {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStore must be used inside a <StoreProvider>.')
  }
  return context
}
