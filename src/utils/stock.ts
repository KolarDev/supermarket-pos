import type { Product, StockMovementType, StockStatus } from '../types/pos'

/**
 * Stock status presentation, shared by the till, the inventory ledger and the
 * product directory. Three consumers is the point: a status is derived in one
 * place, so a product can never read "In Stock" on one screen and "Low Stock"
 * on another.
 */
export const STOCK_BADGES: Record<StockStatus, { label: string; className: string }> = {
  IN_STOCK: { label: 'In Stock', className: 'bg-success-50 text-success-800 ring-success-200' },
  LOW_STOCK: { label: 'Low Stock', className: 'bg-warning-50 text-warning-700 ring-warning-200' },
  OUT_OF_STOCK: {
    label: 'Out of Stock',
    className: 'bg-danger-50 text-danger-800 ring-danger-200',
  },
}

/** At or below `minStock` the line needs attention; zero is out entirely. */
export const getStockStatus = (product: Product): StockStatus => {
  if (product.stock <= 0) return 'OUT_OF_STOCK'
  if (product.stock <= product.minStock) return 'LOW_STOCK'
  return 'IN_STOCK'
}

/** Products that need reordering, most urgent (lowest stock) first. */
export const needsAttention = (product: Product): boolean =>
  product.active && product.stock <= product.minStock

/** The adjustments a storekeeper performs, each mapping to a movement type. */
export type AdjustmentKind = Extract<StockMovementType, 'PURCHASE' | 'DAMAGE' | 'ADJUSTMENT'>

/**
 * Signed stock delta for an adjustment.
 *
 * A delivery always adds, a write-off always removes, and a correction follows
 * whichever direction the operator picked. Getting a sign wrong here writes off
 * stock instead of receiving it, so the rule lives on its own rather than
 * inline in the form.
 *
 * Returns 0 for anything that is not a positive whole number, which callers
 * treat as "nothing to apply".
 */
export function computeAdjustmentDelta(
  kind: AdjustmentKind,
  quantity: number,
  direction: 1 | -1 = 1,
): number {
  if (!Number.isInteger(quantity) || quantity <= 0) return 0
  if (kind === 'DAMAGE') return -quantity
  if (kind === 'ADJUSTMENT') return direction * quantity
  return quantity
}
