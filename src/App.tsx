import { useState } from 'react'
import { Navbar } from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import POS from './pages/POS'
import Products from './pages/Products'
import type { Page } from './types/nav'

/**
 * App shell. The navbar owns the chrome and the pitch controls, `main` owns the
 * screen. Tab state rather than a router: four screens that share one store and
 * no URL requirements don't justify the dependency, and each page is already
 * self-contained enough to drop behind a router later.
 */
export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    /* `print:min-h-0` matters: `min-h-screen` would keep a full page of empty
       layout alive behind the receipt and feed a blank sheet after it. */
    <div className="flex min-h-screen flex-col bg-slate-100 lg:h-screen print:h-auto print:min-h-0">
      <Navbar page={page} onNavigate={setPage} />

      {/* Keyed on the page so the fade replays on every switch, and `lg:h-full`
          so the screens that scroll internally still have a definite height. */}
      <main className="flex-1 lg:min-h-0">
        <div key={page} className="animate-page-in lg:h-full">
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {page === 'pos' && <POS />}
          {page === 'products' && <Products />}
          {page === 'inventory' && <Inventory />}
        </div>
      </main>
    </div>
  )
}
