import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { INITIAL_MOVEMENTS, INITIAL_PRODUCTS } from '../data/mockData'
import type {
  AddToCartResult,
  CartItem,
  PaymentMethod,
  Product,
  Sale,
  StockMovement,
  UserRole,
} from '../types/pos'

/** Nigeria's standard VAT rate, applied to the subtotal of every sale. */
export const VAT_RATE = 0.075

const STORAGE_KEY = 'supermarket-pos.state.v1'
/** Receipts are sequential from here so the first demo receipt reads REC-10023. */
const FIRST_RECEIPT_SEQUENCE = 10023

/** Naira carries kobo — round money at every step so VAT can't drift. */
const round2 = (value: number) => Math.round(value * 100) / 100

let idCounter = 0
/** Short, collision-resistant ids for rows created during the session. */
const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${(idCounter++).toString(36)}`

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
  sales: [],
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
   * Throws on an empty cart or insufficient payment — callers should validate
   * against `cartTotal` first and surface the message to the operator.
   */
  completeSale: (
    paymentMethod: PaymentMethod,
    amountReceived: number,
    cashierName: string,
  ) => Sale
  /** Manual correction or delivery. Throws if the product id is unknown. */
  adjustStock: (productId: string, delta: number, reason: string) => void
  toggleOfflineMode: () => void
  switchRole: (role: UserRole) => void
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
    const subtotal = round2(
      cart.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0),
    )
    const vat = round2(subtotal * VAT_RATE)
    return {
      count: cart.reduce((units, item) => units + item.quantity, 0),
      subtotal,
      vat,
      total: round2(subtotal + vat),
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
    (
      paymentMethod: PaymentMethod,
      amountReceived: number,
      cashierName: string,
    ): Sale => {
      if (cart.length === 0) {
        throw new Error('Cannot complete a sale with an empty cart.')
      }

      const subtotal = round2(
        cart.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0),
      )
      // No discount UI yet — the field exists so Sale rows stay forward-compatible.
      const discount = 0
      const vat = round2(subtotal * VAT_RATE)
      const total = round2(subtotal + vat - discount)

      if (amountReceived < total) {
        throw new Error(
          `Insufficient payment — ₦${total.toLocaleString('en-NG')} due, ` +
            `₦${amountReceived.toLocaleString('en-NG')} received.`,
        )
      }

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
        paymentMethod,
        amountReceived: round2(amountReceived),
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
    (productId: string, delta: number, reason: string) => {
      const product = products.find((candidate) => candidate.id === productId)
      if (!product) throw new Error(`Unknown product: ${productId}`)
      if (!Number.isFinite(delta) || delta === 0) return

      const movement: StockMovement = {
        id: makeId('MV'),
        productId,
        productName: product.name,
        type: 'ADJUSTMENT',
        quantityDelta: delta,
        reason,
        user: currentRole,
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

  const toggleOfflineMode = useCallback(() => setIsOffline((prev) => !prev), [])
  const switchRole = useCallback((role: UserRole) => setCurrentRole(role), [])

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
      toggleOfflineMode,
      switchRole,
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
      toggleOfflineMode,
      switchRole,
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
