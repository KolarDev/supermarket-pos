/**
 * The app's icon set.
 *
 * Hand-rolled rather than pulled from a library: the prototype ships with no
 * icon dependency, and a dozen 24×24 stroke glyphs is less code than the
 * import surface of a package that would only be used for these.
 *
 * Every glyph draws with `currentColor` and sizes from the caller's class, so
 * an icon inherits its button's colour and hover state for free.
 */
import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>

/** Shared frame: 24×24, stroked, hidden from assistive tech. */
function Glyph({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const StoreIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M3.4 9.6 5.4 4h13.2l2 5.6" />
    <path d="M4.8 9.6V19a1 1 0 0 0 1 1h12.4a1 1 0 0 0 1-1V9.6" />
    <path d="M9.6 20v-5.4h4.8V20" />
  </Glyph>
)

export const DashboardIcon = (props: IconProps) => (
  <Glyph {...props}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
  </Glyph>
)

/** Barcode — the till scans, so this reads as the register. */
export const ScanIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M4 5v14M7 5v14M10.5 5v14M14 5v14M17 5v14M20 5v14" />
  </Glyph>
)

export const PackageIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M12 3 3.2 7.5v9L12 21l8.8-4.5v-9L12 3Z" />
    <path d="M3.2 7.5 12 12l8.8-4.5M12 12v9" />
  </Glyph>
)

export const LedgerIcon = (props: IconProps) => (
  <Glyph {...props}>
    <ellipse cx="12" cy="6" rx="7.5" ry="3" />
    <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
    <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
  </Glyph>
)

export const BanknoteIcon = (props: IconProps) => (
  <Glyph {...props}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6.2 10v4M17.8 10v4" />
  </Glyph>
)

export const ReceiptIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-3-1.8-3 1.8-3-1.8L6 21Z" />
    <path d="M9.5 8h5M9.5 12h5" />
  </Glyph>
)

export const WarehouseIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M3 20V9.2L12 4l9 5.2V20" />
    <path d="M3 20h18" />
    <path d="M9 20v-6h6v6" />
  </Glyph>
)

export const AlertIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M12 4.2 2.8 19.8h18.4L12 4.2Z" />
    <path d="M12 10v4.4M12 17.4h.01" />
  </Glyph>
)

export const TrendingUpIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M3 17 9.5 10.5l4 4L21 7" />
    <path d="M15.5 7H21v5.5" />
  </Glyph>
)

export const ArrowRightIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
  </Glyph>
)

export const BoltIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M13.2 2.8 5.4 13.6h5.4l-1 7.6 7.8-10.8h-5.4l1-7.6Z" />
  </Glyph>
)

export const PlusIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M12 5v14M5 12h14" />
  </Glyph>
)

export const MinusIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M5 12h14" />
  </Glyph>
)

/** Hamburger — opens the navigation drawer below `md`. */
export const MenuIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M4 6.5h16M4 12h16M4 17.5h16" />
  </Glyph>
)

export const CloseIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />
  </Glyph>
)

/** Trolley — the cart tab and the mobile review bar. */
export const CartIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M2.8 4h2.3l2.3 10.9a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.3L20.4 7H6.1" />
    <circle cx="9.6" cy="19.6" r="1.3" />
    <circle cx="17.4" cy="19.6" r="1.3" />
  </Glyph>
)

/** Tick in a circle — the settled / exact-tender state. */
export const CheckIcon = (props: IconProps) => (
  <Glyph {...props}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M8.4 12.3l2.5 2.4 4.7-5" />
  </Glyph>
)

/** Sparkle — marks a control that fills a field in for you. */
export const SparkIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M10.5 3.2 12 7.6l4.4 1.5-4.4 1.5-1.5 4.4-1.5-4.4L4.6 9.1l4.4-1.5Z" />
    <path d="M17.6 14.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
  </Glyph>
)

export const RefreshIcon = (props: IconProps) => (
  <Glyph {...props}>
    <path d="M20.5 11.5A8.5 8.5 0 0 0 6 5.6L3.5 8" />
    <path d="M3.5 4v4h4" />
    <path d="M3.5 12.5A8.5 8.5 0 0 0 18 18.4l2.5-2.4" />
    <path d="M20.5 20v-4h-4" />
  </Glyph>
)
