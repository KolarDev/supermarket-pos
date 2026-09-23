import { OPERATOR_NAMES } from './operators'
import type { CartItem, PaymentMethod, Product, Sale, StockMovement, Tender } from '../types/pos'
import { priceLines, round2 } from '../utils/money'
import { normaliseTenders, settlementOf, tenderTotal } from '../utils/payments'

/**
 * Seed data for a mid-sized Nigerian supermarket.
 *
 * Barcodes are structurally valid EAN-13 codes (correct GS1 check digit) using
 * the 615 GS1 Nigeria prefix, except the loose eggs which use a leading `2` —
 * the GS1 range reserved for in-store / restricted-circulation numbers. They
 * are synthesised for the prototype, not the manufacturers' live codes.
 *
 * Prices are whole Naira and reflect 2026 shelf prices. Stock levels are
 * deliberately mixed so every badge state renders on first load:
 *   normal  → in stock (green)   |  low → amber  |  zero → crimson
 *
 * `stock` is the shelf count *today*. The ledger below covers the last week
 * rather than the store's whole life, so the two are not expected to reconcile
 * to zero — this is what a real till looks like when it loads a window of
 * movements instead of every row since opening.
 *
 * Product images resolve to `/products/<slug>.svg`; drop real photography into
 * `public/products/` using the same filenames.
 */
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'PRD-001',
    name: 'Coca-Cola PET Bottle 50cl',
    sku: 'BEV-COKE-50',
    barcode: '6151100248916',
    category: 'Beverages',
    sellingPrice: 350,
    costPrice: 275,
    stock: 148,
    minStock: 36,
    image: '/products/coca-cola-50cl.svg',
    active: true,
  },
  {
    id: 'PRD-002',
    name: 'Fanta Orange PET Bottle 50cl',
    sku: 'BEV-FANT-50',
    barcode: '6151100374622',
    category: 'Beverages',
    sellingPrice: 350,
    costPrice: 275,
    stock: 96,
    minStock: 36,
    image: '/products/fanta-orange-50cl.svg',
    active: true,
  },
  {
    id: 'PRD-003',
    name: 'Eva Table Water 75cl',
    sku: 'BEV-EVA-75',
    barcode: '6151100937483',
    category: 'Beverages',
    sellingPrice: 200,
    costPrice: 140,
    stock: 240,
    minStock: 60,
    image: '/products/eva-water-75cl.svg',
    active: true,
  },
  {
    id: 'PRD-004',
    name: 'Indomie Chicken Flavour 70g',
    sku: 'SNK-IND-CHK',
    barcode: '6152200193755',
    category: 'Snacks & Confectionery',
    sellingPrice: 400,
    costPrice: 320,
    stock: 312,
    minStock: 72,
    image: '/products/indomie-chicken-70g.svg',
    active: true,
  },
  {
    id: 'PRD-005',
    name: 'Gala Sausage Roll',
    sku: 'SNK-GALA-01',
    barcode: '6152200583211',
    category: 'Snacks & Confectionery',
    sellingPrice: 250,
    costPrice: 190,
    stock: 0,
    minStock: 24,
    image: '/products/gala-sausage-roll.svg',
    active: true,
  },
  {
    id: 'PRD-006',
    name: 'Golden Penny Semovita 1kg',
    sku: 'GRN-GPS-1KG',
    barcode: '6153300451288',
    category: 'Grains & Staples',
    sellingPrice: 2100,
    costPrice: 1780,
    stock: 54,
    minStock: 12,
    image: '/products/golden-penny-semovita-1kg.svg',
    active: true,
  },
  {
    id: 'PRD-007',
    name: 'Golden Penny Granulated Sugar 500g',
    sku: 'GRN-GPS-500',
    barcode: '6153300562403',
    category: 'Grains & Staples',
    sellingPrice: 1300,
    costPrice: 1080,
    stock: 8,
    minStock: 15,
    image: '/products/golden-penny-sugar-500g.svg',
    active: true,
  },
  {
    id: 'PRD-008',
    name: 'Honeywell Spaghetti 500g',
    sku: 'GRN-HON-SPG',
    barcode: '6153300614928',
    category: 'Grains & Staples',
    sellingPrice: 1400,
    costPrice: 1150,
    stock: 88,
    minStock: 24,
    image: '/products/honeywell-spaghetti-500g.svg',
    active: true,
  },
  {
    id: 'PRD-009',
    name: 'Abakaliki Local Rice 5kg',
    sku: 'GRN-RICE-5KG',
    barcode: '6155500132769',
    category: 'Grains & Staples',
    sellingPrice: 9500,
    costPrice: 8200,
    stock: 23,
    minStock: 8,
    image: '/products/local-rice-5kg.svg',
    active: true,
  },
  {
    id: 'PRD-010',
    name: 'Dangote Refined Salt 500g',
    sku: 'GRN-DAN-SLT',
    barcode: '6156600284174',
    category: 'Grains & Staples',
    sellingPrice: 450,
    costPrice: 340,
    stock: 120,
    minStock: 30,
    image: '/products/dangote-salt-500g.svg',
    active: true,
  },
  {
    id: 'PRD-011',
    name: 'Peak Milk Powder Sachet 140g',
    sku: 'DAI-PEAK-140',
    barcode: '6154400726139',
    category: 'Dairy & Breakfast',
    sellingPrice: 1450,
    costPrice: 1180,
    stock: 41,
    minStock: 18,
    image: '/products/peak-milk-140g.svg',
    active: true,
  },
  {
    id: 'PRD-012',
    name: 'Milo Refill 400g',
    sku: 'DAI-MILO-400',
    barcode: '6154400819046',
    category: 'Dairy & Breakfast',
    sellingPrice: 4900,
    costPrice: 4150,
    stock: 4,
    minStock: 10,
    image: '/products/milo-refill-400g.svg',
    active: true,
  },
  {
    id: 'PRD-013',
    name: 'Molfix Diapers Medium (30 Pieces)',
    sku: 'BAB-MOLF-M30',
    barcode: '6157700415932',
    category: 'Baby & Infant',
    sellingPrice: 7800,
    costPrice: 6600,
    stock: 0,
    minStock: 6,
    image: '/products/molfix-diapers-medium-30.svg',
    active: true,
  },
  {
    id: 'PRD-014',
    name: 'Omo Multi-Active Detergent 500g',
    sku: 'HOM-OMO-500',
    barcode: '6158800241650',
    category: 'Home Care',
    sellingPrice: 1500,
    costPrice: 1240,
    stock: 66,
    minStock: 18,
    image: '/products/omo-detergent-500g.svg',
    active: true,
  },
  {
    id: 'PRD-015',
    name: 'Dettol Original Soap 110g',
    sku: 'PER-DET-110',
    barcode: '6159900372848',
    category: 'Personal Care',
    sellingPrice: 900,
    costPrice: 720,
    stock: 132,
    minStock: 36,
    image: '/products/dettol-soap-110g.svg',
    active: true,
  },
  {
    id: 'PRD-016',
    name: 'Close-Up Toothpaste Red Hot 140g',
    sku: 'PER-CLO-140',
    barcode: '6159900461733',
    category: 'Personal Care',
    sellingPrice: 1400,
    costPrice: 1160,
    stock: 2,
    minStock: 12,
    image: '/products/close-up-toothpaste-140g.svg',
    active: true,
  },
  {
    id: 'PRD-017',
    name: 'Fresh Eggs (Crate of 30)',
    sku: 'FRM-EGG-30',
    barcode: '200000017538',
    category: 'Farm & Fresh',
    sellingPrice: 5500,
    costPrice: 4700,
    stock: 17,
    minStock: 6,
    image: '/products/fresh-eggs-crate-30.svg',
    active: true,
  },
  {
    // Retired line — exercises the `active: false` path in the catalogue UI.
    id: 'PRD-018',
    name: 'Nutri Yoghurt Strawberry 500ml',
    sku: 'DAI-NUT-YOG',
    barcode: '6154400952705',
    category: 'Dairy & Breakfast',
    sellingPrice: 1800,
    costPrice: 1500,
    stock: 0,
    minStock: 12,
    image: '/products/nutri-yoghurt-strawberry-500ml.svg',
    active: false,
  },
]

/* ---------------------------------------------------------------------------
   Seeded activity — one week of trade.

   Timestamps are anchored to the day the app first boots rather than to fixed
   calendar dates. The dashboard's headline figure is *today's* takings, and a
   hard-coded date would read ₦0.00 for every demo after the one it was written
   for. The cost is that the seed freezes into localStorage on first load, which
   is what the navbar's Reset control exists to undo.

   Sales are authored as a compact spec and priced by the same `priceLines`
   helper the register uses, and each sale's SALE movement is generated from the
   sale itself. The ledger therefore cannot drift from the receipts: there is
   only one description of what was sold, and it is this one.
--------------------------------------------------------------------------- */

const NGOZI = OPERATOR_NAMES.Cashier
const EMEKA = OPERATOR_NAMES.Manager

const productById = new Map(INITIAL_PRODUCTS.map((product) => [product.id, product]))

/** A local time `daysAgo` days back, at a given local hour. */
const dayAt = (daysAgo: number, hour: number, minute = 0): string => {
  const now = new Date()
  // The `Date` constructor normalises out-of-range day values, so this is safe
  // across month and year boundaries.
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysAgo,
    hour,
    minute,
  ).toISOString()
}

/**
 * A time earlier today, measured back from now rather than pinned to a clock
 * hour — a demo run at 09:00 must not show receipts from the afternoon.
 *
 * The offsets are compressed into the part of today that has actually happened,
 * which keeps their relative order intact at any hour.
 */
const todayAt = (minutesAgo: number): string => {
  const now = new Date()
  const elapsed = now.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const span = Math.max(elapsed, 30 * 60_000)
  const offset = Math.min(minutesAgo * 60_000, span - 60_000)
  return new Date(now.getTime() - Math.max(offset, 60_000)).toISOString()
}

interface SeedSale {
  /** Sequential, oldest first — receipt numbers must ascend with time. */
  receipt: number
  at: string
  cashier: string
  /** A single-tender sale. Omit when `split` is given instead. */
  method?: PaymentMethod
  /**
   * A mixed-tender sale: `[method, naira]` pairs that must cover the total.
   * Written out in full rather than as a "balance on card" rule so the seed
   * table shows the actual money, and a typo fails loudly at import.
   */
  split?: [PaymentMethod, number][]
  /** `[productId, quantity]` pairs. */
  lines: [string, number][]
}

/**
 * One week of trade, oldest first. Receipts run 10000 → 10022 so the next sale
 * rung up on the till is REC-10023.
 */
const SEED_SALES: SeedSale[] = [
  // --- six days ago
  {
    receipt: 10000,
    at: dayAt(6, 9, 15),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-003', 4], ['PRD-004', 2]],
  },
  {
    receipt: 10001,
    at: dayAt(6, 16, 40),
    cashier: NGOZI,
    method: 'TRANSFER',
    lines: [['PRD-009', 1], ['PRD-010', 2]],
  },
  // --- five days ago
  {
    receipt: 10002,
    at: dayAt(5, 10, 5),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-001', 6], ['PRD-002', 6]],
  },
  {
    receipt: 10003,
    at: dayAt(5, 18, 22),
    cashier: EMEKA,
    method: 'CARD',
    lines: [['PRD-012', 1], ['PRD-011', 2], ['PRD-010', 1]],
  },
  // --- four days ago
  {
    receipt: 10004,
    at: dayAt(4, 8, 50),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-004', 10]],
  },
  {
    receipt: 10005,
    at: dayAt(4, 13, 30),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-005', 6], ['PRD-003', 6]],
  },
  {
    receipt: 10006,
    at: dayAt(4, 19, 10),
    cashier: EMEKA,
    method: 'CARD',
    lines: [['PRD-006', 2], ['PRD-008', 1]],
  },
  // --- three days ago
  {
    receipt: 10007,
    at: dayAt(3, 9, 40),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-011', 3], ['PRD-015', 2]],
  },
  {
    receipt: 10008,
    at: dayAt(3, 12, 15),
    cashier: NGOZI,
    method: 'TRANSFER',
    lines: [['PRD-009', 2]],
  },
  {
    receipt: 10009,
    at: dayAt(3, 17, 55),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-001', 4], ['PRD-004', 4], ['PRD-005', 4]],
  },
  // --- two days ago
  {
    receipt: 10010,
    at: dayAt(2, 8, 30),
    cashier: EMEKA,
    method: 'CASH',
    lines: [['PRD-007', 3], ['PRD-010', 1]],
  },
  {
    receipt: 10011,
    at: dayAt(2, 14, 5),
    cashier: NGOZI,
    method: 'CARD',
    lines: [['PRD-014', 2], ['PRD-015', 4]],
  },
  {
    receipt: 10012,
    at: dayAt(2, 18, 45),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-012', 1], ['PRD-008', 2]],
  },
  // --- yesterday
  {
    receipt: 10013,
    at: dayAt(1, 9, 20),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-003', 12]],
  },
  {
    receipt: 10014,
    at: dayAt(1, 11, 35),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-004', 6], ['PRD-002', 3]],
  },
  {
    receipt: 10015,
    at: dayAt(1, 15, 50),
    cashier: EMEKA,
    method: 'TRANSFER',
    lines: [['PRD-013', 1], ['PRD-011', 1]],
  },
  {
    receipt: 10016,
    at: dayAt(1, 19, 25),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-016', 1], ['PRD-015', 2], ['PRD-010', 2]],
  },
  // --- today, most recent last
  {
    receipt: 10017,
    at: todayAt(342),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-001', 8], ['PRD-004', 6]],
  },
  {
    receipt: 10018,
    at: todayAt(268),
    cashier: EMEKA,
    method: 'CARD',
    lines: [['PRD-006', 3], ['PRD-007', 2], ['PRD-010', 3]],
  },
  {
    // Wholesale order — the reason this line shows 48 units in the ledger.
    // Paid part cash and the balance by transfer, which is how a ₦12,900 order
    // is actually settled here. The only seeded sale that exercises the
    // receipt's tender breakdown.
    receipt: 10019,
    at: todayAt(186),
    cashier: NGOZI,
    split: [
      ['CASH', 5000],
      ['TRANSFER', 7900],
    ],
    lines: [['PRD-005', 48]],
  },
  {
    receipt: 10020,
    at: todayAt(96),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-003', 10], ['PRD-014', 3]],
  },
  {
    receipt: 10021,
    at: todayAt(46),
    cashier: NGOZI,
    method: 'CASH',
    lines: [['PRD-012', 1]],
  },
  {
    receipt: 10022,
    at: todayAt(12),
    cashier: EMEKA,
    method: 'CARD',
    lines: [['PRD-013', 2]],
  },
]

/** The smallest note a customer would plausibly hand over for this total. */
function roundTender(total: number): number {
  const note = total > 20_000 ? 5_000 : total > 5_000 ? 1_000 : 500
  return Math.ceil(total / note) * note
}

/**
 * The tenders a seeded sale was settled with.
 *
 * Cash customers hand over notes, which is what gives the receipts realistic
 * change; card and transfer settle for the exact total. A sale declaring
 * neither, or a split that does not cover the bill, throws at import rather
 * than seeding a receipt that cannot be reconciled.
 */
function buildTenders(spec: SeedSale, total: number): Tender[] {
  if (spec.split) {
    const tenders = normaliseTenders(spec.split.map(([method, amount]) => ({ method, amount })))
    const paid = tenderTotal(tenders)
    if (paid < total) {
      throw new Error(
        `Seed sale ${spec.receipt} tenders ${paid} against a total of ${total}.`,
      )
    }
    return tenders
  }

  if (!spec.method) throw new Error(`Seed sale ${spec.receipt} declares no payment method.`)
  return [{ method: spec.method, amount: spec.method === 'CASH' ? roundTender(total) : total }]
}

/** Prices a seeded basket exactly as `completeSale` would. */
function buildSale(spec: SeedSale): Sale {
  const items: CartItem[] = spec.lines.map(([id, quantity]) => {
    const product = productById.get(id)
    if (!product) throw new Error(`Seed sale ${spec.receipt} references unknown product ${id}`)
    return { product, quantity }
  })

  const { subtotal, vat, total } = priceLines(
    items.map((item) => ({ unitPrice: item.product.sellingPrice, quantity: item.quantity })),
  )

  const payments = buildTenders(spec, total)
  const amountReceived = tenderTotal(payments)

  return {
    id: `SALE-${spec.receipt}`,
    receiptNumber: `REC-${spec.receipt}`,
    items,
    subtotal,
    vat,
    discount: 0,
    total,
    payments,
    settlement: settlementOf(payments),
    amountReceived,
    change: round2(amountReceived - total),
    cashier: spec.cashier,
    timestamp: spec.at,
  }
}

/**
 * Newest first, the order `completeSale` prepends in — so the dashboard and
 * the ledger can render the array as-is.
 */
export const INITIAL_SALES: Sale[] = SEED_SALES.map(buildSale).reverse()

/**
 * Movements the ledger holds on top of the sales: the stock take the week opens
 * from, a delivery, a write-off and a correction. Between them they exercise
 * every movement type the audit trail can render.
 */
const MANUAL_MOVEMENTS: StockMovement[] = [
  {
    id: 'MV-000006',
    productId: 'PRD-007',
    productName: 'Golden Penny Granulated Sugar 500g',
    type: 'PURCHASE',
    quantityDelta: 24,
    reason: 'Supplier delivery — Grand Cereals invoice GC-88214',
    user: EMEKA,
    timestamp: dayAt(4, 8, 10),
  },
  {
    id: 'MV-000005',
    productId: 'PRD-016',
    productName: 'Close-Up Toothpaste Red Hot 140g',
    // Written off rather than corrected — the two are distinct in the ledger.
    type: 'DAMAGE',
    quantityDelta: -3,
    reason: 'Damaged in transit — written off',
    user: EMEKA,
    timestamp: dayAt(3, 16, 30),
  },
  {
    id: 'MV-000004',
    productId: 'PRD-018',
    productName: 'Nutri Yoghurt Strawberry 500ml',
    type: 'ADJUSTMENT',
    quantityDelta: -9,
    reason: 'Expired batch withdrawn — line discontinued',
    user: EMEKA,
    timestamp: dayAt(5, 8, 0),
  },
  {
    // Oldest row — the count this week's ledger is reconciled against.
    id: 'MV-000003',
    productId: 'PRD-009',
    productName: 'Abakaliki Local Rice 5kg',
    type: 'OPENING_STOCK',
    quantityDelta: 40,
    reason: 'Opening count — start of week stock take',
    user: EMEKA,
    timestamp: dayAt(6, 7, 0),
  },
]

/** The SALE rows a completed sale writes — same fields `completeSale` writes. */
const movementsForSale = (sale: Sale): StockMovement[] =>
  sale.items.map((item) => ({
    id: `MV-${sale.receiptNumber.slice(4)}-${item.product.id.slice(4)}`,
    productId: item.product.id,
    productName: item.product.name,
    type: 'SALE',
    quantityDelta: -item.quantity,
    reason: `Sold on receipt ${sale.receiptNumber}`,
    user: sale.cashier,
    timestamp: sale.timestamp,
  }))

/**
 * Opening stock ledger, newest first. Sorted rather than hand-ordered so the
 * audit trail is chronological no matter how the seeds above are edited.
 */
export const INITIAL_MOVEMENTS: StockMovement[] = [
  ...MANUAL_MOVEMENTS,
  ...INITIAL_SALES.flatMap(movementsForSale),
].sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
