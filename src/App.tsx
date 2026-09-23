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
    /* A viewport-locked shell: the chrome never scrolls, each screen owns its
       own scrolling, and a footer inside a screen can pin to the bottom of the
       viewport — which is what keeps the cart's Complete Sale button reachable
       on a phone. `dvh` rather than `vh` so a mobile browser's collapsing
       address bar does not push the footer under the fold.
       The print overrides undo all of it: a fixed-height, clipped shell would
       feed a blank sheet after the receipt. */
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-100 print:h-auto print:min-h-0 print:overflow-visible">
      <Navbar page={page} onNavigate={setPage} />

      {/* `min-h-0` lets this shrink below its content so the screen inside can
          scroll rather than stretching the shell past the viewport. */}
      <main className="min-h-0 flex-1">
        <div key={page} className="animate-page-in h-full">
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {page === 'pos' && <POS />}
          {page === 'products' && <Products />}
          {page === 'inventory' && <Inventory />}
        </div>
      </main>
    </div>
  )
}
