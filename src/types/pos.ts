/**
 * Domain types for the POS & Inventory prototype.
 *
 * Deliberately flat and JSON-serialisable: every interface here maps 1:1 to a
 * row you would eventually get back from a REST endpoint or SQL table, so the
 * mock data can be swapped for a real API without reshaping the UI layer.
 */

/** Who is signed in at the till. Gates stock adjustments and reporting. */
export type UserRole = 'Cashier' | 'Manager'

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

export type StockMovementType =
  | 'OPENING_STOCK'
  | 'SALE'
  | 'PURCHASE'
  | 'ADJUSTMENT'

/** Aisles of a Nigerian supermarket — keeps category filters type-safe. */
export type ProductCategory =
  | 'Beverages'
  | 'Grains & Staples'
  | 'Dairy & Breakfast'
  | 'Snacks & Confectionery'
  | 'Personal Care'
  | 'Home Care'
  | 'Baby & Infant'
  | 'Farm & Fresh'

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
  paymentMethod: PaymentMethod
  amountReceived: number
  /** Change handed back; always 0 for CARD and TRANSFER. */
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
