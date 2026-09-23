import { useMemo, useState } from 'react'
import { AddProductModal } from '../components/AddProductModal'
import { PlusIcon } from '../components/Icons'
import { StockAdjustmentModal } from '../components/StockAdjustmentModal'
import { useStore } from '../context/StoreContext'
import type { Product, ProductCategory } from '../types/pos'
import { formatNaira } from '../utils/format'
import { STOCK_BADGES, getStockStatus } from '../utils/stock'

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warning' | 'danger' }) {
  const toneClass =
    tone === 'danger' ? 'text-danger-700' : tone === 'warning' ? 'text-warning-700' : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  )
}

export default function Products() {
  const { products } = useStore()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'ALL'>('ALL')
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)
  const [addingProduct, setAddingProduct] = useState(false)
  /** Highlighted until the next one lands, so the save is visibly confirmed. */
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  const categories = useMemo(() => {
    const seen = new Set<ProductCategory>()
    for (const product of products) seen.add(product.category)
    return Array.from(seen).sort()
  }, [products])

  const metrics = useMemo(() => {
    // Alert counts are scoped to active lines — a discontinued product sitting
    // at zero is not something anyone needs to reorder.
    const active = products.filter((product) => product.active)
    return {
      totalSkus: products.length,
      // Valued at retail, per spec. Cost basis (stock x costPrice) is what an
      // accountant would call inventory value.
      inventoryValue: products.reduce(
        (total, product) => total + product.stock * product.sellingPrice,
        0,
      ),
      lowStock: active.filter((product) => product.stock > 0 && product.stock <= product.minStock)
        .length,
      outOfStock: active.filter((product) => product.stock <= 0).length,
    }
  }, [products])

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products
      .filter((product) => {
        if (categoryFilter !== 'ALL' && product.category !== categoryFilter) return false
        if (!query) return true
        return (
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          product.barcode.includes(query)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, search, categoryFilter])

  const handleAdded = (product: Product) => {
    // An active filter would hide the line that was just created, which reads
    // as a failed save. Clearing both keeps the new row in the rendered set.
    setSearch('')
    setCategoryFilter('ALL')
    setLastAddedId(product.id)
  }

  return (
    <div className="scrollbar-slim h-full space-y-6 overflow-y-auto p-4 lg:p-6 print:hidden">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Product Directory
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {products.length} SKUs in the catalogue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddingProduct(true)}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
        >
          <PlusIcon className="h-4 w-4" />
          Add Product
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total SKUs" value={String(metrics.totalSkus)} />
        <Metric label="Inventory Value" value={formatNaira(metrics.inventoryValue)} />
        <Metric label="Low Stock" value={String(metrics.lowStock)} tone="warning" />
        <Metric label="Out of Stock" value={String(metrics.outOfStock)} tone="danger" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Catalogue</h2>
            <p className="text-xs text-slate-500">
              {visibleProducts.length} of {products.length} products
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, SKU or barcode…"
              aria-label="Search products"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15 sm:w-64 sm:flex-none"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as ProductCategory | 'ALL')}
              aria-label="Filter by category"
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
            >
              <option value="ALL">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {visibleProducts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No products match the current filters.
          </p>
        ) : (
          /* Below `lg` the table sheds its two attribute columns and folds both
             into the product cell, so a phone shows four columns rather than
             scrolling six sideways. `overflow-x-auto` stays as the backstop for
             the narrowest handsets. */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm lg:min-w-[52rem]">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Product</th>
                  <th scope="col" className="hidden px-5 py-2.5 font-medium lg:table-cell">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Price</th>
                  <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Stock Level</th>
                  <th scope="col" className="hidden px-5 py-2.5 font-medium lg:table-cell">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleProducts.map((product) => {
                  const badge = STOCK_BADGES[getStockStatus(product)]
                  const isNew = product.id === lastAddedId
                  return (
                    <tr key={product.id} className={isNew ? 'bg-success-50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3 sm:px-5">
                        <p className="font-medium text-slate-900">
                          {product.name}
                          {isNew && (
                            <span className="ml-2 rounded-full bg-success-100 px-2 py-0.5 align-middle text-[10px] font-semibold text-success-800">
                              New
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          {product.sku}
                          <span className="hidden sm:inline"> · {product.barcode}</span>
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 lg:hidden">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {product.category}
                          </span>
                          {!product.active && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-300">
                              Inactive
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="hidden px-5 py-3 lg:table-cell">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-slate-600">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 tabular-nums sm:px-5">
                        {formatNaira(product.sellingPrice)}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-2">
                          <span className="w-10 text-right font-semibold text-slate-900 tabular-nums">
                            {product.stock}
                          </span>
                          {/* Where the pill will not fit, the dot still carries
                              the status — with the word kept for screen readers. */}
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full sm:hidden ${badge.dot}`}
                          >
                            <span className="sr-only">{badge.label}</span>
                          </span>
                          <span
                            className={`hidden rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 sm:inline ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </td>
                      <td className="hidden px-5 py-3 lg:table-cell">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                            product.active
                              ? 'bg-success-50 text-success-800 ring-success-200'
                              : 'bg-slate-100 text-slate-500 ring-slate-300'
                          }`}
                        >
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5">
                        <button
                          type="button"
                          onClick={() => setAdjustingProduct(product)}
                          className="min-h-9 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap transition hover:bg-slate-100 sm:px-3"
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adjustingProduct && (
        <StockAdjustmentModal
          key={adjustingProduct.id}
          product={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
        />
      )}

      {addingProduct && (
        <AddProductModal onClose={() => setAddingProduct(false)} onAdded={handleAdded} />
      )}
    </div>
  )
}
