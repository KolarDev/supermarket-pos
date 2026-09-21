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
    <div className="space-y-6 p-4 lg:h-full lg:overflow-y-auto lg:p-6 print:hidden">
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
          className="flex items-center gap-2 rounded-lg bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Catalogue</h2>
            <p className="text-xs text-slate-500">
              {visibleProducts.length} of {products.length} products
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, SKU or barcode…"
              aria-label="Search products"
              className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as ProductCategory | 'ALL')}
              aria-label="Filter by category"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-5 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Category</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Price</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Stock Level</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleProducts.map((product) => {
                  const badge = STOCK_BADGES[getStockStatus(product)]
                  const isNew = product.id === lastAddedId
                  return (
                    <tr key={product.id} className={isNew ? 'bg-success-50' : 'hover:bg-slate-50'}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">
                          {product.name}
                          {isNew && (
                            <span className="ml-2 rounded-full bg-success-100 px-2 py-0.5 align-middle text-[10px] font-semibold text-success-800">
                              New
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          {product.sku} · {product.barcode}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-slate-600">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900 tabular-nums">
                        {formatNaira(product.sellingPrice)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-10 text-right font-semibold text-slate-900 tabular-nums">
                            {product.stock}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
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
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setAdjustingProduct(product)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap transition hover:bg-slate-100"
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
