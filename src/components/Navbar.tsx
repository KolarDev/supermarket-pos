/**
 * Persistent navigation shell: branding, the screen tabs, and the controls the
 * pitch demo needs — simulate a lost connection, switch the signed-in role, and
 * restore the seed data.
 *
 * Below `md` the tabs and the demo controls move into a side drawer behind a
 * hamburger. A phone cannot lay out four tabs plus three controls in one row,
 * and shrinking them to fit would leave nothing big enough to hit with a thumb
 * on a handheld terminal.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../context/StoreContext'
import { OPERATOR_NAMES } from '../data/operators'
import type { Page } from '../types/nav'
import type { UserRole } from '../types/pos'
import {
  BoltIcon,
  CloseIcon,
  DashboardIcon,
  LedgerIcon,
  MenuIcon,
  PackageIcon,
  RefreshIcon,
  ScanIcon,
  StoreIcon,
} from './Icons'

interface NavbarProps {
  page: Page
  onNavigate: (page: Page) => void
}

interface NavItem {
  id: Page
  label: string
  /** All icons share the same signature, so one stands in for the set. */
  Icon: typeof DashboardIcon
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { id: 'pos', label: 'POS Register', Icon: ScanIcon },
  { id: 'products', label: 'Products', Icon: PackageIcon },
  { id: 'inventory', label: 'Inventory', Icon: LedgerIcon },
]

const ROLES: UserRole[] = ['Cashier', 'Manager']

const DRAWER_ID = 'mobile-nav-drawer'

export function Navbar({ page, onNavigate }: NavbarProps) {
  const { isOffline, currentRole, toggleOfflineMode, switchRole, resetDemoData } = useStore()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    // Focus goes back to the control that opened the drawer. Without this the
    // next Tab press would resume from the top of the document, stranding a
    // keyboard user at the far end of the page.
    menuButtonRef.current?.focus()
  }, [])

  const handleReset = () => {
    // Destructive: it discards every sale rung up in this session, so it asks
    // first even though the demo data comes straight back.
    const confirmed = window.confirm(
      'Restore the seeded demo data? Sales rung up in this session will be lost.',
    )
    if (confirmed) resetDemoData()
  }

  const handleNavigate = (next: Page) => {
    onNavigate(next)
    // Picking a destination is the drawer's whole purpose, so it gets out of
    // the way rather than making the operator close it themselves.
    closeDrawer()
  }

  // Escape closes, and the page behind must not scroll under the drawer. The
  // app shell is viewport-locked today so the lock is belt-and-braces, but the
  // drawer should not depend on that staying true.
  useEffect(() => {
    if (!drawerOpen) return
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', handleKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [drawerOpen, closeDrawer])

  const brand = (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-800 ring-1 ring-brand-700">
        <StoreIcon className="h-5 w-5 text-brand-200" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold tracking-tight">SUPERMARKET POS</p>
        {/* Only shown once the header has room for it — the role is also on the
            selector to the right, so nothing is lost by dropping it. */}
        <p className="hidden truncate text-[11px] text-brand-300 xl:block">
          {OPERATOR_NAMES[currentRole]} · {currentRole}
        </p>
      </div>
    </div>
  )

  return (
    <>
      <div className="relative z-40 shrink-0 print:hidden">
        {/* Pinned above the header so it stays at the top of the viewport. */}
        {isOffline && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 bg-warning-500 px-4 py-1.5 text-center text-[11px] font-semibold text-warning-950 sm:text-xs"
          >
            <BoltIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Running in Local Offline Mode. Sales will sync when connection is restored.</span>
          </div>
        )}

        <header className="flex items-center justify-between gap-3 bg-brand-900 px-3 py-2.5 text-white sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              aria-controls={DRAWER_ID}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-brand-200 transition hover:bg-brand-800 hover:text-white md:hidden"
            >
              <MenuIcon className="h-6 w-6" />
            </button>

            {brand}

            <nav aria-label="Main" className="hidden min-w-0 gap-1 overflow-x-auto md:flex">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = page === id
                return (
                  <button
                    key={id}
                    type="button"
                    // The label is dropped between `md` and `lg` for width, so
                    // the name has to come from somewhere the eye is not using.
                    aria-label={label}
                    aria-current={active ? 'page' : undefined}
                    title={label}
                    onClick={() => onNavigate(id)}
                    className={`flex min-h-11 shrink-0 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition xl:px-3 ${
                      active
                        ? 'bg-white text-brand-900 shadow-sm'
                        : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="hidden lg:inline">{label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* ------------------------------------------- pitch demo toolbar */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] font-medium uppercase tracking-wide text-brand-300 xl:inline">
                Role
              </span>
              <div
                role="group"
                aria-label="Active role"
                className="flex gap-0.5 rounded-lg bg-brand-950/60 p-0.5 ring-1 ring-brand-700"
              >
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={currentRole === role}
                    onClick={() => switchRole(role)}
                    className={`min-h-9 rounded-md px-2.5 text-xs font-semibold transition ${
                      currentRole === role
                        ? 'bg-white text-brand-900 shadow-sm'
                        : 'text-brand-300 hover:text-white'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={toggleOfflineMode}
              aria-pressed={isOffline}
              title={
                isOffline
                  ? 'Reconnect and flush the queued sales'
                  : 'Simulate a lost connection to the till'
              }
              className={`flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold ring-1 transition ${
                isOffline
                  ? 'bg-warning-400 text-warning-950 ring-warning-300 hover:bg-warning-300'
                  : 'bg-success-100 text-success-800 ring-success-200 hover:bg-success-200'
              }`}
            >
              {isOffline ? (
                <BoltIcon className="h-3.5 w-3.5" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-success-600" aria-hidden="true" />
              )}
              {isOffline ? 'Offline Mode' : 'Online'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              title="Restore the seeded demo data"
              className="flex min-h-9 items-center gap-1.5 rounded-md bg-brand-800 px-2.5 text-xs font-semibold text-brand-200 ring-1 ring-brand-700 transition hover:bg-brand-700 hover:text-white"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </header>
      </div>

      {/* ------------------------------------------------------ side drawer */}
      {/* Kept mounted so it can animate in both directions, and made `inert`
          while closed: that takes the whole subtree out of the tab order and
          the accessibility tree, so nothing inside is reachable until it is
          actually on screen. */}
      <div
        inert={!drawerOpen}
        className={`fixed inset-0 z-50 md:hidden ${drawerOpen ? '' : 'pointer-events-none'}`}
      >
        <div
          onClick={closeDrawer}
          aria-hidden="true"
          className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <aside
          id={DRAWER_ID}
          role="dialog"
          aria-modal="true"
          aria-label="Main navigation"
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-brand-900 text-white shadow-2xl transition-transform duration-200 ease-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-800 px-3 py-3.5">
            {brand}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-brand-200 transition hover:bg-brand-800 hover:text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </header>

          <nav aria-label="Screens" className="min-h-0 flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = page === id
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => handleNavigate(id)}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                        active
                          ? 'bg-white text-brand-900 shadow-sm'
                          : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="shrink-0 space-y-4 border-t border-brand-800 p-4">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-brand-300">
                Active role
              </p>
              <div
                role="group"
                aria-label="Active role"
                className="grid grid-cols-2 gap-1 rounded-lg bg-brand-950/60 p-1 ring-1 ring-brand-700"
              >
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={currentRole === role}
                    onClick={() => switchRole(role)}
                    className={`min-h-11 rounded-md text-xs font-semibold transition ${
                      currentRole === role
                        ? 'bg-white text-brand-900 shadow-sm'
                        : 'text-brand-300 hover:text-white'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={toggleOfflineMode}
              aria-pressed={isOffline}
              className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold ring-1 transition ${
                isOffline
                  ? 'bg-warning-400 text-warning-950 ring-warning-300'
                  : 'bg-success-100 text-success-800 ring-success-200'
              }`}
            >
              {isOffline ? (
                <BoltIcon className="h-4 w-4" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-success-600" aria-hidden="true" />
              )}
              {isOffline ? 'Offline Mode' : 'Online'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-800 text-xs font-semibold text-brand-200 ring-1 ring-brand-700 transition hover:bg-brand-700 hover:text-white"
            >
              <RefreshIcon className="h-4 w-4" />
              Reset Demo Data
            </button>
          </div>
        </aside>
      </div>
    </>
  )
}
