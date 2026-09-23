/**
 * Domain types for the POS & Inventory prototype.
 *
 * Deliberately flat and JSON-serialisable: every interface here maps 1:1 to a
 * row you would eventually get back from a REST endpoint or SQL table, so the
 * mock data can be swapped for a real API without reshaping the UI layer.
 */

/** Who is signed in at the till. Gates stock adjustments and reporting. */
export type UserRole = 'Cashier' | 'Manager'

/** A tender an operator can actually take across the counter. */
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

/**
 * One tender handed over at the till.
 *
 * A sale holds a *list* of these rather than a single method, because splitting
 * a bill is routine — a wholesale order part cash and the balance by transfer,
 * or a customer who is ₦2,000 short on the card. Modelling the single-method
 * case as a one-element list keeps one shape for both.
 */
export interface Tender {
  method: PaymentMethod
  /** Naira handed over on this method. Never negative, never zero. */
  amount: number
}

/**
 * How a sale settled, for one-line reporting in list views.
 *
 * `'SPLIT'` is a *summary*, not something anyone can hand over — which is why
 * it is not part of `PaymentMethod` and cannot be used as a `Tender.method`.
 * The tenders themselves live on `Sale.payments`.
 */
export type Settlement = PaymentMethod | 'SPLIT'

export type StockMovementType =
  | 'OPENING_STOCK'
  | 'SALE'
  | 'PURCHASE'
  /** Stock written off — breakage, expiry, theft. Always a negative delta. */
  | 'DAMAGE'
  | 'ADJUSTMENT'

/**
 * Aisles of a Nigerian supermarket — keeps category filters type-safe.
 *
 * The list is the source of truth and the union is derived from it, so the
 * "Add Product" form can render the aisles without a second hand-maintained
 * array drifting out of step with the type.
 */
export const PRODUCT_CATEGORIES = [
  'Beverages',
  'Grains & Staples',
  'Dairy & Breakfast',
  'Snacks & Confectionery',
  'Personal Care',
  'Home Care',
  'Baby & Infant',
  'Farm & Fresh',
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

/** Derived from `stock` vs `minStock` — never stored, always computed. */
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export interface Product {
  id: string
  name: string
  /** Human-readable stock code used on shelf labels, e.g. `BEV-COKE-50`. */
  sku: string
  /** EAN-13 for packaged goods, or an in-store code with a leading 2. */
  barcode: string
  category: ProductCategory
  /** Retail price in Naira, tax-exclusive. */
  sellingPrice: number
  /** What the store paid in Naira — drives margin reporting. */
  costPrice: number
  stock: number
  /** Reorder threshold; at or below this the line goes amber. */
  minStock: number
  /** Path under `public/`, e.g. `/products/coca-cola-50cl.svg`. */
  image: string
  /** `false` retires a line without deleting its sales history. */
  active: boolean
}

/**
 * What the catalogue form collects for a new line.
 *
 * `id`, `image` and `active` are deliberately absent: the id is allocated on
 * insert so two operators cannot pick the same one, a new line is active by
 * definition, and nothing renders `image` yet.
 */
export interface NewProductInput {
  name: string
  sku: string
  barcode: string
  category: ProductCategory
  sellingPrice: number
  costPrice: number
  /** Opening count. Written to the ledger as an OPENING_STOCK movement if > 0. */
  stock: number
  minStock: number
}

export interface CartItem {
  /**
   * Snapshot of the product at scan time. This is intentional: the price the
   * customer was quoted must not move if a manager edits the catalogue
   * mid-transaction.
   */
  product: Product
  quantity: number
}

export interface StockMovement {
  id: string
  productId: string
  /** Denormalised so the audit log stays readable if a product is deleted. */
  productName: string
  type: StockMovementType
  /** Signed: negative for sales, positive for purchases and corrections. */
  quantityDelta: number
  reason: string
  user: string
  /** ISO-8601. */
  timestamp: string
}

export interface Sale {
  id: string
  /** Printed on the customer receipt, e.g. `REC-10023`. */
  receiptNumber: string
  items: CartItem[]
  subtotal: number
  /** 7.5% VAT, already included in `total`. */
  vat: number
  discount: number
  total: number
  /**
   * Every tender taken, in the order the operator entered them. Always holds at
   * least one non-zero entry — a sale with no money against it is not a sale.
   */
  payments: Tender[]
  /**
   * Denormalised one-line summary of `payments`: the method when a single
   * tender settled the bill, `'SPLIT'` when several did. Kept as a field so a
   * list view can badge a sale without walking its tenders.
   */
  settlement: Settlement
  /** Everything handed over, summed across methods. */
  amountReceived: number
  /**
   * Change handed back. Drawn from the cash tender — a card terminal cannot
   * produce change — so it can never exceed the cash the customer put down.
   */
  change: number
  cashier: string
  /** ISO-8601. */
  timestamp: string
}

/**
 * Outcome of a scan. A till must tell the operator *why* a scan failed
 * (unknown barcode vs. out of stock), so `addToCart` reports rather than
 * silently no-ops.
 */
export interface AddToCartResult {
  ok: boolean
  message: string
  product?: Product
}
