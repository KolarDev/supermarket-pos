import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PaymentMethod, Tender } from '../types/pos'
import { formatNaira } from '../utils/format'
import { round2 } from '../utils/money'
import {
  TENDER_METHODS,
  balanceDue,
  checkoutBanner,
  maxChargeable,
  tenderProblem,
  tenderTotal,
} from '../utils/payments'
import {
  BankIcon,
  BanknoteIcon,
  CardIcon,
  CheckIcon,
  CloseIcon,
  VerifiedIcon,
} from './Icons'
import { CardPaymentModal } from './CardPaymentModal'
import { TransferPaymentModal } from './TransferPaymentModal'

const TENDER_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  TRANSFER: 'Transfer',
}

const TENDER_ICONS: Record<PaymentMethod, typeof BanknoteIcon> = {
  CASH: BanknoteIcon,
  CARD: CardIcon,
  TRANSFER: BankIcon,
}

/** Common Nigerian banknotes, for one-tap cash entry. */
const QUICK_TENDER = [1000, 5000, 10000, 20000]
const NO_CASH = ''

/** A card or transfer that already went through, with the code to prove it. */
interface RecordedPayment {
  amount: number
  reference: string
}

interface CheckoutDrawerProps {
  open: boolean
  cartCount: number
  subtotal: number
  vat: number
  total: number
  onClose: () => void
  /** Commits the sale. A thrown validation error leaves the drawer open. */
  onComplete: (payments: Tender[]) => void
}

/**
 * The payment half of the register.
 *
 * The cart stays deliberately payment-free: its only forward action is this
 * drawer, so cash, card and transfer cannot be selected by accident while an
 * operator is still building the basket. Payment state stays mounted when the
 * drawer is merely closed, so backing out to review the cart never discards a
 * tender already entered.
 */
export function CheckoutDrawer({
  open,
  cartCount,
  subtotal,
  vat,
  total,
  onClose,
  onComplete,
}: CheckoutDrawerProps) {
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>('CASH')
  const [cashTendered, setCashTendered] = useState(NO_CASH)
  const [cardPayment, setCardPayment] = useState<RecordedPayment | null>(null)
  const [transferPayment, setTransferPayment] = useState<RecordedPayment | null>(null)
  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [completionError, setCompletionError] = useState('')

  const panelRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const cardReturnFocusRef = useRef<HTMLElement | null>(null)
  const transferReturnFocusRef = useRef<HTMLElement | null>(null)

  // The page beneath a full-height drawer must not move while the operator
  // handles money. The drawer owns its own scroll region, so this does not
  // strand the payment controls.
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (open) closeButtonRef.current?.focus()
  }, [open])

  // Keep keyboard focus inside the drawer. While a card or transfer dialog is
  // open, that child owns Escape and focus; otherwise one Escape press would
  // close both layers at once.
  useEffect(() => {
    if (!open || cardDialogOpen || transferDialogOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cardDialogOpen, onClose, open, transferDialogOpen])

  // A half-typed minus sign is not money. Clamp at the boundary so it can never
  // inflate a split-payment balance or an amount offered to the terminal.
  const parsedCash = Number.parseFloat(cashTendered)
  const cash = Number.isFinite(parsedCash) ? Math.max(0, parsedCash) : 0
  const payments = useMemo<Tender[]>(() => {
    const list: Tender[] = []
    if (cash > 0) list.push({ method: 'CASH', amount: cash })
    if (cardPayment) list.push({ method: 'CARD', ...cardPayment })
    if (transferPayment) list.push({ method: 'TRANSFER', ...transferPayment })
    return list
  }, [cash, cardPayment, transferPayment])

  const paid = tenderTotal(payments)
  const balance = balanceDue(payments, total)
  const problem = tenderProblem(payments, total)
  const banner = checkoutBanner(payments, total)
  const canComplete = total > 0 && problem === null
  const paidPercent = total > 0 ? Math.min(100, (paid / total) * 100) : 0

  /** What is booked on every method except the one currently being considered. */
  const paidElsewhere = (method: PaymentMethod) =>
    round2(
      paid -
        (method === 'CASH'
          ? cash
          : method === 'CARD'
            ? (cardPayment?.amount ?? 0)
            : (transferPayment?.amount ?? 0)),
    )

  /** The most this method may still take against the current bill. */
  const chargeable = (method: PaymentMethod) => maxChargeable(total, paidElsewhere(method))

  const rememberFocus = (ref: { current: HTMLElement | null }) => {
    if (document.activeElement instanceof HTMLElement) ref.current = document.activeElement
  }

  const openCardDialog = () => {
    rememberFocus(cardReturnFocusRef)
    setCompletionError('')
    setCardDialogOpen(true)
  }

  const openTransferDialog = () => {
    rememberFocus(transferReturnFocusRef)
    setCompletionError('')
    setTransferDialogOpen(true)
  }

  /** Card and Transfer tabs lead straight into their processing flow. */
  const selectMethod = (method: PaymentMethod) => {
    setActiveMethod(method)
    if (method === 'CARD' && !cardPayment) openCardDialog()
    if (method === 'TRANSFER' && !transferPayment) openTransferDialog()
  }

  const closeCardDialog = () => {
    setCardDialogOpen(false)
    window.requestAnimationFrame(() => cardReturnFocusRef.current?.focus())
  }

  const closeTransferDialog = () => {
    setTransferDialogOpen(false)
    window.requestAnimationFrame(() => transferReturnFocusRef.current?.focus())
  }

  const clearPayment = (method: PaymentMethod) => {
    setCompletionError('')
    if (method === 'CASH') setCashTendered(NO_CASH)
    else if (method === 'CARD') setCardPayment(null)
    else setTransferPayment(null)
  }

  const completeSale = () => {
    setCompletionError('')
    try {
      onComplete(payments)
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : 'Could not complete the sale.')
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 print:hidden">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="checkout-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-[36rem] flex-col bg-white shadow-2xl outline-none sm:max-w-[38rem]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
              <BanknoteIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 id="checkout-title" className="text-base font-bold text-slate-900 sm:text-lg">
                Checkout
              </h2>
              <p className="text-xs text-slate-500">
                {cartCount} item{cartCount === 1 ? '' : 's'} ready for payment
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
          {/* -------------------------------------------- amount being settled */}
          <section className="border-b border-slate-200 bg-slate-50 p-4 sm:p-5" aria-label="Order summary">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Order Summary</h3>
              <span className="text-xs text-slate-500">{cartCount} units</span>
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="money font-medium text-slate-800">{formatNaira(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">VAT (7.5%)</dt>
                <dd className="money font-medium text-slate-800">{formatNaira(vat)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-end justify-between gap-4 rounded-xl bg-brand-900 px-4 py-3.5 text-white shadow-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-200">
                  Grand Total
                </p>
                <p className="mt-1 text-xs text-brand-200/70">Amount due now</p>
              </div>
              <p className="money text-3xl font-bold tracking-tight sm:text-4xl">
                {formatNaira(total)}
              </p>
            </div>
          </section>

          {/* ------------------------------------------------- payment method */}
          <section className="space-y-4 p-4 sm:p-5" aria-labelledby="payment-method-title">
            <div>
              <div className="flex items-end justify-between gap-3">
                <h3 id="payment-method-title" className="text-sm font-semibold text-slate-900">
                  Payment Method
                </h3>
                <p className="money text-xs text-slate-500 tabular-nums">
                  {formatNaira(paid)} paid
                </p>
              </div>

              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  role="progressbar"
                  aria-label="Share of the bill tendered"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(paidPercent)}
                  className={`h-full rounded-full transition-[width] duration-200 ${
                    balance < 0 ? 'bg-warning-500' : 'bg-success-600'
                  }`}
                  style={{ width: `${paidPercent}%` }}
                />
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Payment method"
              className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200"
            >
              {TENDER_METHODS.map((method) => {
                const Icon = TENDER_ICONS[method]
                const selected = activeMethod === method
                const settled =
                  method === 'CASH'
                    ? cash > 0
                    : method === 'CARD'
                      ? cardPayment !== null
                      : transferPayment !== null
                return (
                  <button
                    key={method}
                    type="button"
                    role="tab"
                    id={`checkout-tender-tab-${method}`}
                    aria-selected={selected}
                    aria-controls="checkout-tender-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectMethod(method)}
                    onKeyDown={(event) => {
                      const currentIndex = TENDER_METHODS.indexOf(method)
                      let nextIndex: number | null = null
                      if (event.key === 'ArrowRight') {
                        nextIndex = (currentIndex + 1) % TENDER_METHODS.length
                      } else if (event.key === 'ArrowLeft') {
                        nextIndex =
                          (currentIndex - 1 + TENDER_METHODS.length) % TENDER_METHODS.length
                      } else if (event.key === 'Home') {
                        nextIndex = 0
                      } else if (event.key === 'End') {
                        nextIndex = TENDER_METHODS.length - 1
                      }
                      if (nextIndex === null) return

                      event.preventDefault()
                      const nextMethod = TENDER_METHODS[nextIndex]
                      setActiveMethod(nextMethod)
                      const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                        '[role="tab"]',
                      )
                      tabs?.[nextIndex].focus()
                    }}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
                      selected
                        ? 'bg-white text-brand-900 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {TENDER_LABELS[method]}
                    {settled && (
                      <>
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-success-600"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Payment recorded</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>

            <div
              id="checkout-tender-panel"
              role="tabpanel"
              aria-labelledby={`checkout-tender-tab-${activeMethod}`}
              className="min-h-44"
            >
              {activeMethod === 'CASH' && (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="checkout-tender-CASH"
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      Cash received (₦)
                    </label>
                    <input
                      id="checkout-tender-CASH"
                      inputMode="decimal"
                      autoComplete="off"
                      value={cashTendered}
                      onChange={(event) => setCashTendered(event.target.value)}
                      placeholder="0.00"
                      className="money min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-right text-lg font-bold text-slate-900 outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_TENDER.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setCashTendered(String(amount))}
                        className="min-h-11 rounded-lg border border-slate-300 bg-white px-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {formatNaira(amount)}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCashTendered(String(chargeable('CASH')))}
                    className="min-h-11 w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Use exact balance · {formatNaira(chargeable('CASH'))}
                  </button>
                </div>
              )}

              {activeMethod === 'CARD' && (
                <div className="space-y-3">
                  {cardPayment ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-success-50 px-4 py-3 ring-1 ring-success-200">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-success-800">
                          <VerifiedIcon className="h-4 w-4 shrink-0" />
                          Payment approved
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-success-700">
                          {cardPayment.reference}
                        </p>
                      </div>
                      <span className="money shrink-0 text-base font-bold text-success-800">
                        {formatNaira(cardPayment.amount)}
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand-900 shadow-sm ring-1 ring-slate-200">
                        <CardIcon className="h-5 w-5" />
                      </span>
                      <h4 className="mt-3 text-sm font-semibold text-slate-900">Card terminal</h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Charge the customer through Terminal POS-01. Up to{' '}
                        <span className="money font-semibold text-slate-700">
                          {formatNaira(chargeable('CARD'))}
                        </span>{' '}
                        can be taken on this method.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {cardPayment && (
                      <button
                        type="button"
                        onClick={() => clearPayment('CARD')}
                        className="min-h-12 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Void
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={openCardDialog}
                      className="min-h-12 flex-[2] rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
                    >
                      {cardPayment ? 'Charge a different amount' : 'Start card payment'}
                    </button>
                  </div>
                </div>
              )}

              {activeMethod === 'TRANSFER' && (
                <div className="space-y-3">
                  {transferPayment ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-success-50 px-4 py-3 ring-1 ring-success-200">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-success-800">
                          <VerifiedIcon className="h-4 w-4 shrink-0" />
                          Transfer verified
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-success-700">
                          {transferPayment.reference}
                        </p>
                      </div>
                      <span className="money shrink-0 text-base font-bold text-success-800">
                        {formatNaira(transferPayment.amount)}
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand-900 shadow-sm ring-1 ring-slate-200">
                        <BankIcon className="h-5 w-5" />
                      </span>
                      <h4 className="mt-3 text-sm font-semibold text-slate-900">Bank transfer</h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Show the store account and a unique reference, then verify the amount received
                        against the ledger. Up to{' '}
                        <span className="money font-semibold text-slate-700">
                          {formatNaira(chargeable('TRANSFER'))}
                        </span>{' '}
                        can be booked.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {transferPayment && (
                      <button
                        type="button"
                        onClick={() => clearPayment('TRANSFER')}
                        className="min-h-12 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Void
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={openTransferDialog}
                      className="min-h-12 flex-[2] rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
                    >
                      {transferPayment ? 'Book a different amount' : 'View transfer details'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* --------------------------------------------- split-payment ledger */}
          {payments.length > 0 && (
            <section className="border-t border-slate-200 px-4 py-4 sm:px-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payments Taken
              </h3>
              <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {payments.map((tender) => (
                  <li
                    key={tender.method}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700">
                        {TENDER_LABELS[tender.method]}
                      </p>
                      {tender.reference && (
                        <p className="truncate font-mono text-[10px] text-slate-500">
                          {tender.reference}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="money text-sm font-bold text-slate-900">
                        {formatNaira(tender.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => clearPayment(tender.method)}
                        aria-label={`Remove the ${TENDER_LABELS[tender.method]} payment`}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-danger-50 hover:text-danger-700"
                      >
                        <CloseIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div aria-live="polite" className="px-4 pb-4 sm:px-5 sm:pb-5">
            {banner.kind === 'DUE' && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-warning-50 px-4 py-3 text-sm font-semibold text-warning-800 ring-1 ring-warning-200">
                <span>Remaining balance due</span>
                <span className="money">{formatNaira(banner.amount)}</span>
              </div>
            )}

            {banner.kind === 'BLOCKED' && (
              <p className="rounded-lg bg-danger-50 px-4 py-3 text-sm font-medium text-danger-800 ring-1 ring-danger-200">
                {banner.message}
              </p>
            )}

            {banner.kind === 'CHANGE' && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-success-50 px-4 py-3 text-sm font-semibold text-success-800 ring-1 ring-success-200">
                <span>Change due</span>
                <span className="money">{formatNaira(banner.amount)}</span>
              </div>
            )}

            {banner.kind === 'EXACT' && (
              <div className="flex items-center gap-2 rounded-lg bg-success-50 px-4 py-3 text-sm font-semibold text-success-800 ring-1 ring-success-200">
                <CheckIcon className="h-4 w-4 shrink-0" />
                Exact amount tendered. The sale is ready to complete.
              </div>
            )}

            {completionError && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-danger-50 px-4 py-3 text-sm font-medium text-danger-800 ring-1 ring-danger-200"
              >
                {completionError}
              </p>
            )}
          </div>
        </div>

        {/* The one action that leaves checkout stays outside the scroll region. */}
        <footer className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] sm:px-5">
          <button
            type="button"
            onClick={completeSale}
            disabled={!canComplete}
            className="min-h-14 w-full rounded-xl bg-brand-900 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none sm:text-base"
          >
            {canComplete
              ? `Complete Sale · ${formatNaira(total)}`
              : balance < 0
                ? `Pay ${formatNaira(round2(total - paid))} more to complete`
                : 'Complete Sale'}
          </button>
        </footer>
      </aside>

      {cardDialogOpen && (
        <CardPaymentModal
          total={total}
          paidElsewhere={paidElsewhere('CARD')}
          recorded={cardPayment?.amount ?? 0}
          onApprove={(amount, reference) => {
            setCardPayment({ amount, reference })
            setActiveMethod('CARD')
            setCompletionError('')
          }}
          onClose={closeCardDialog}
        />
      )}

      {transferDialogOpen && (
        <TransferPaymentModal
          total={total}
          paidElsewhere={paidElsewhere('TRANSFER')}
          recorded={transferPayment?.amount ?? 0}
          onConfirm={(amount, reference) => {
            setTransferPayment({ amount, reference })
            setActiveMethod('TRANSFER')
            setCompletionError('')
          }}
          onClose={closeTransferDialog}
        />
      )}
    </div>,
    document.body,
  )
}
