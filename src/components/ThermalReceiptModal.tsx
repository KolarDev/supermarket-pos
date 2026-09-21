import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useStore } from '../context/StoreContext'
import type { Sale } from '../types/pos'
import { formatNaira } from '../utils/format'

interface ThermalReceiptModalProps {
  sale: Sale | null
  onClose: () => void
}

const STORE_NAME = 'SUPERMARKET POS'
const STORE_ADDRESS = '123 Commercial Avenue, Lagos'
const STORE_PHONE = 'Tel: +234 800 123 4567'

/** Receipts read `21/09/2026 14:42` — compact, unambiguous, unpadded locale-free. */
function formatReceiptDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/**
 * Builds deterministic bar widths from a string. Same receipt number always
 * yields the same graphic, so a reprinted receipt is visually identical.
 */
function buildBarWidths(value: string): number[] {
  let seed = 7
  for (let index = 0; index < value.length; index += 1) {
    seed = (seed * 31 + value.charCodeAt(index)) % 99991
  }
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  // Even indices render as bars, odd as gaps. The first and last few are pinned
  // to thin widths to mimic the guard patterns on a real EAN symbol.
  return Array.from({ length: 58 }, (_, index) =>
    index < 2 || index > 55 ? 1 : 1 + Math.floor(next() * 3),
  )
}

function ReceiptBarcode({ value }: { value: string }) {
  const unit = 1.6
  const widths = buildBarWidths(value)
  const bars: ReactElement[] = []
  let cursor = 0

  widths.forEach((width, index) => {
    const scaled = width * unit
    if (index % 2 === 0) {
      bars.push(<rect key={index} x={cursor} y={0} width={scaled} height={44} />)
    }
    cursor += scaled
  })

  return (
    <svg
      viewBox={`0 0 ${cursor} 44`}
      width="100%"
      height="44"
      preserveAspectRatio="none"
      className="text-slate-900"
      fill="currentColor"
      role="img"
      aria-label={`Barcode for receipt ${value}`}
    >
      {bars}
    </svg>
  )
}

/** Dotted rule — thermal printers render these as a run of hyphens. */
function Divider() {
  return <div className="my-3 border-t border-dashed border-slate-400" />
}

function SummaryRow({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className={`flex justify-between gap-2 ${emphasis ? 'text-[13px] font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export function ThermalReceiptModal({ sale, onClose }: ThermalReceiptModalProps) {
  // NOTE: `Sale` (Stage 1) records the cashier's name but not their role, so the
  // role line reflects whoever is signed in now rather than who rang the sale.
  // See the handover notes — one extra field on `Sale` makes this exact.
  const { currentRole } = useStore()
  const printButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!sale) return
    printButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sale, onClose])

  if (!sale) return null

  const { receiptNumber, items, subtotal, vat, total, paymentMethod, amountReceived, change } = sale
  const unitCount = items.reduce((units, item) => units + item.quantity, 0)
  const isCash = paymentMethod === 'CASH'

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm print:static print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none"
      onClick={onClose}
      role="presentation"
    >
      {/* Print rules live in `index.css` under "Print isolation" — that block
          hides the whole app and re-shows only `#thermal-receipt-modal`, so
          the `@page` size and the roll geometry have to sit with it rather
          than in a second stylesheet that would fight it on source order. */}

      <div
        id="thermal-receipt-modal"
        className="mx-auto flex min-h-full w-[80mm] max-w-full flex-col items-center justify-center gap-4 print:min-h-0 print:w-auto print:gap-0"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt ${receiptNumber}`}
      >
        <article className="w-full rounded-sm bg-white px-4 py-5 font-mono text-[11px] leading-relaxed text-slate-900 shadow-xl ring-1 ring-slate-300 print:rounded-none print:px-[4mm] print:pt-[2mm] print:pb-[8mm] print:shadow-none print:ring-0">
          <header className="text-center">
            <h2 className="text-[14px] font-bold tracking-[0.12em]">{STORE_NAME}</h2>
            <p className="mt-1 text-[10px]">{STORE_ADDRESS}</p>
            <p className="text-[10px]">{STORE_PHONE}</p>
          </header>

          <Divider />

          <section className="space-y-0.5 text-[10px]">
            <div className="flex justify-between gap-2">
              <span>Receipt</span>
              <span className="font-bold tabular-nums">{receiptNumber}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Date</span>
              <span className="tabular-nums">{formatReceiptDate(sale.timestamp)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Cashier</span>
              <span className="text-right">{sale.cashier}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Role</span>
              <span>{currentRole}</span>
            </div>
          </section>

          <Divider />

          <section>
            <div className="flex justify-between gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span>Item</span>
              <span>Amount</span>
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {items.map((item) => (
                <li key={item.product.id}>
                  <p className="break-words">{item.product.name}</p>
                  <div className="flex justify-between gap-2 pl-2 text-[10px] text-slate-700">
                    <span className="tabular-nums">
                      {item.quantity} x {formatNaira(item.product.sellingPrice)}
                    </span>
                    <span className="tabular-nums">
                      {formatNaira(item.product.sellingPrice * item.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <Divider />

          <section className="space-y-0.5">
            <SummaryRow label="Subtotal" value={formatNaira(subtotal)} />
            <SummaryRow label="VAT (7.5%)" value={formatNaira(vat)} />
            <div className="my-1.5 border-t border-dashed border-slate-400" />
            <SummaryRow label="TOTAL" value={formatNaira(total)} emphasis />
          </section>

          <Divider />

          <section className="space-y-0.5 text-[10px]">
            <div className="flex justify-between gap-2">
              <span>Payment</span>
              <span className="font-bold">{paymentMethod}</span>
            </div>
            {isCash && (
              <>
                <div className="flex justify-between gap-2">
                  <span>Received</span>
                  <span className="tabular-nums">{formatNaira(amountReceived)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Change</span>
                  <span className="tabular-nums">{formatNaira(change)}</span>
                </div>
              </>
            )}
          </section>

          <Divider />

          <footer className="text-center">
            <p className="text-[10px] font-bold tracking-wide">THANK YOU FOR YOUR PATRONAGE!</p>
            <p className="mt-1 text-[9px] text-slate-600">
              {unitCount} item{unitCount === 1 ? '' : 's'} · Goods sold in good condition are not
              refundable
            </p>
            <div className="mt-3 px-2">
              <ReceiptBarcode value={receiptNumber} />
              <p className="mt-1 text-[9px] tracking-[0.2em] tabular-nums">{receiptNumber}</p>
            </div>
          </footer>
        </article>

        <div className="flex w-full gap-2 print:hidden">
          <button
            ref={printButtonRef}
            type="button"
            onClick={() => window.print()}
            className="flex-1 rounded-md bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Print Receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close / New Sale
          </button>
        </div>
      </div>
    </div>
  )
}
