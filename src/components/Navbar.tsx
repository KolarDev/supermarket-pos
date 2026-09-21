/**
 * Persistent navigation shell: branding, the screen tabs, and the controls the
 * pitch demo needs — simulate a lost connection, switch the signed-in role, and
 * restore the seed data.
 */
import { useStore } from '../context/StoreContext'
import { OPERATOR_NAMES } from '../data/operators'
import type { Page } from '../types/nav'
import type { UserRole } from '../types/pos'
import {
  BoltIcon,
  DashboardIcon,
  LedgerIcon,
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

export function Navbar({ page, onNavigate }: NavbarProps) {
  const { isOffline, currentRole, toggleOfflineMode, switchRole, resetDemoData } = useStore()

  const handleReset = () => {
    // Destructive: it discards every sale rung up in this session, so it asks
    // first even though the demo data comes straight back.
    const confirmed = window.confirm(
      'Restore the seeded demo data? Sales rung up in this session will be lost.',
    )
    if (confirmed) resetDemoData()
  }

  return (
    <div className="sticky top-0 z-40 print:hidden">
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

      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-brand-900 px-4 py-3 text-white sm:px-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-800 ring-1 ring-brand-700">
              <StoreIcon className="h-5 w-5 text-brand-200" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">SUPERMARKET POS</p>
              <p className="text-[11px] text-brand-300">
                {OPERATOR_NAMES[currentRole]} · {currentRole}
              </p>
            </div>
          </div>

          <nav aria-label="Main" className="flex gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const active = page === id
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(id)}
                  className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-white text-brand-900 shadow-sm'
                      : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* ------------------------------------------- pitch demo toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] font-medium uppercase tracking-wide text-brand-300 sm:inline">
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
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
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
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ring-1 transition ${
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
            className="flex items-center gap-1.5 rounded-md bg-brand-800 px-2.5 py-1.5 text-xs font-semibold text-brand-200 ring-1 ring-brand-700 transition hover:bg-brand-700 hover:text-white"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </header>
    </div>
  )
}
