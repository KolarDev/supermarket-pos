import { useState } from 'react'
import { useStore } from './context/StoreContext'
import type { Product } from './types/pos'

/**
 * Placeholder shell. It exists to prove the design tokens and store context are
 * wired up — the real till, inventory and reporting screens replace it.
 */

const naira = (value: number) =>
  `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function stockBadge(product: Product) {
  if (product.stock <= 0) {
    return { label: 'Out of stock', className: 'bg-danger-50 text-danger-800 ring-danger-200' }
  }
  if (product.stock <= product.minStock) {
    return {
      label: `Low · ${product.stock}`,
      className: 'bg-warning-50 text-warning-700 ring-warning-200',
    }
  }
  return {
    label: `In stock · ${product.stock}`,
    className: 'bg-success-50 text-success-800 ring-success-200',
  }
}

export default function App() {
  const {
    products,
    cart,
    movements,
    isOffline,
    currentRole,
    cartCount,
    cartSubtotal,
    cartVat,
    cartTotal,
    addToCart,
    removeFromCart,
    clearCart,
    completeSale,
    toggleOfflineMode,
    switchRole,
  } = useStore()

  const [scan, setScan] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [lastReceipt, setLastReceipt] = useState<string | null>(null)

  const activeProducts = products.filter((product) => product.active)

  const handleScan = () => {
    const result = addToCart(scan)
    setNotice(result.message)
    if (result.ok) setScan('')
  }

  const handleCompleteSale = () => {
    try {
      const sale = completeSale('CASH', cartTotal, currentRole === 'Manager' ? 'Emeka Balogun' : 'Ngozi Okafor')
      setLastReceipt(`${sale.receiptNumber} · ${naira(sale.total)} · change ${naira(sale.change)}`)
      setNotice(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not complete the sale.')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-brand-900 px-6 py-4 text-white">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Supermarket POS</h1>
          <p className="text-sm text-brand-300">Retail till &amp; inventory</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={toggleOfflineMode}
            className={`rounded-md px-3 py-1.5 font-medium ring-1 transition ${
              isOffline
                ? 'bg-warning-100 text-warning-800 ring-warning-200'
                : 'bg-success-100 text-success-800 ring-success-200'
            }`}
          >
            {isOffline ? 'Offline — queued' : 'Online'}
          </button>
          <button
            type="button"
            onClick={() => switchRole(currentRole === 'Cashier' ? 'Manager' : 'Cashier')}
            className="rounded-md bg-brand-800 px-3 py-1.5 font-medium text-white ring-1 ring-brand-700 transition hover:bg-brand-700"
          >
            Role: {currentRole}
          </button>
        </div>
      </header>

      <main className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem]">
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={scan}
              onChange={(event) => setScan(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleScan()}
              placeholder="Scan barcode or type SKU…"
              className="w-72 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-900"
            />
            <button
              type="button"
              onClick={handleScan}
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800"
            >
              Add to cart
            </button>
            <span className="text-sm text-slate-500">
              {activeProducts.length} active lines · {movements.length} movements
            </span>
          </div>

          {notice && (
            <p className="mb-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-brand-200">
              {notice}
            </p>
          )}

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeProducts.map((product) => {
              const badge = stockBadge(product)
              return (
                <li
                  key={product.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-medium text-slate-900">{product.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{product.barcode}</p>
                  <p className="mt-2 money text-lg font-semibold text-slate-900">
                    {naira(product.sellingPrice)}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Current sale</h2>

          {cart.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Cart is empty.</p>
          ) : (
            <ul className="scrollbar-slim mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {cart.map((item) => (
                <li key={item.product.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.product.name}</p>
                    <p className="money text-xs text-slate-500">
                      {item.quantity} × {naira(item.product.sellingPrice)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-xs font-medium text-danger-700 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="money text-slate-800">{naira(cartSubtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">VAT (7.5%)</dt>
              <dd className="money text-slate-800">{naira(cartVat)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt className="text-slate-900">Total</dt>
              <dd className="money text-slate-900">{naira(cartTotal)}</dd>
            </div>
          </dl>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={cartCount === 0}
              onClick={handleCompleteSale}
              className="flex-1 rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Take cash
            </button>
            <button
              type="button"
              disabled={cartCount === 0}
              onClick={clearCart}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Void
            </button>
          </div>

          {lastReceipt && (
            <p className="mt-3 rounded-md bg-success-50 px-3 py-2 text-xs text-success-800 ring-1 ring-success-200">
              {lastReceipt}
            </p>
          )}
        </aside>
      </main>
    </div>
  )
}
