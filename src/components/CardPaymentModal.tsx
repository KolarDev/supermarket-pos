import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CardIcon, CheckIcon, CloseIcon } from './Icons'
import { formatNaira } from '../utils/format'
import { round2 } from '../utils/money'
import { makeApprovalCode, maxChargeable } from '../utils/payments'

interface CardPaymentModalProps {
  /** The grand total being settled, so the dialog can price what is left of it. */
  total: number
  /** Already taken on cash and transfer — what the card must not duplicate. */
  paidElsewhere: number
  /** Already on the card, when the operator is reopening to correct it. */
  recorded: number
  /** Called once, on approval, with the charge and the acquirer's code. */
  onApprove: (amount: number, reference: string) => void
  onClose: () => void
}

/**
 * How long the terminal "thinks" for.
 *
 * Long enough that the processing state is legible rather than a flicker, short
 * enough that nobody demonstrating the app has to wait for it twice.
 */
const PROCESSING_MS = 2200

type Phase = 'ENTRY' | 'PROCESSING' | 'APPROVED' | 'DECLINED'

/**
 * The card terminal, simulated.
 *
 * A real till hands the acquirer an exact figure and waits; this walks the
 * operator through the same four states — amount, processing, approved or
 * declined — so a demo can show what the till does at each one. Nothing is
 * applied to the bill until the terminal approves, which is the point: an
 * approval that never arrived must not look like money in the drawer.
 *
 * The decline is deliberate rather than random. A demo that fails one time in
 * five is a demo that fails in front of the customer, so the operator chooses.
 */
export function CardPaymentModal({
  total,
  paidElsewhere,
  recorded,
  onApprove,
  onClose,
}: CardPaymentModalProps) {
  /** The most this card may be charged: the bill, less what is already paid. */
  const chargeable = maxChargeable(total, paidElsewhere)

  const [amount, setAmount] = useState(() =>
    String(recorded > 0 ? recorded : chargeable > 0 ? chargeable : ''),
  )
  const [phase, setPhase] = useState<Phase>('ENTRY')
  const [reference, setReference] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  /** Approval must land on the bill exactly once, whatever React re-runs. */
  const appliedRef = useRef(false)

  const parsed = Number.parseFloat(amount)
  const charge = Number.isFinite(parsed) ? round2(parsed) : 0
  const overcharge = charge > chargeable
  const invalid = charge <= 0 || overcharge

  /** What would still be owed once this card payment lands. */
  const stillDue = round2(Math.max(0, round2(total - paidElsewhere - charge)))

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape closes — but not mid-read. A card the terminal is already talking to
  // is not something the operator should be able to walk away from by reflex.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phase !== 'PROCESSING') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (!dialog.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, onClose])

  useEffect(() => {
    if (phase !== 'PROCESSING') return
    const timer = window.setTimeout(() => {
      setReference(makeApprovalCode())
      setPhase('APPROVED')
    }, PROCESSING_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'APPROVED' || appliedRef.current) return
    appliedRef.current = true
    onApprove(charge, reference)
  }, [phase, charge, reference, onApprove])

  return createPortal(
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm print:hidden"
      onClick={() => phase !== 'PROCESSING' && onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="mx-auto flex min-h-full max-w-md items-center justify-center"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Card payment"
      >
        <div className="w-full overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-300">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
                <CardIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Card Payment</h2>
                <p className="text-xs text-slate-500">
                  Terminal POS-01 · {formatNaira(chargeable)} outstanding
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={phase === 'PROCESSING'}
              aria-label="Close"
              className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </header>

          {/* The terminal's own display. Its contents are the state machine. */}
          <div className="bg-brand-900 px-5 py-6 text-center text-white">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-100/70">
              {phase === 'ENTRY' && 'Amount to charge'}
              {phase === 'PROCESSING' && 'Processing payment'}
              {phase === 'APPROVED' && 'Payment approved'}
              {phase === 'DECLINED' && 'Payment declined'}
            </p>

            {phase === 'ENTRY' ? (
              <p className="money mt-2 text-3xl font-bold tabular-nums">
                {formatNaira(charge > 0 ? charge : 0)}
              </p>
            ) : (
              <p className="money mt-2 text-3xl font-bold tabular-nums">
                {formatNaira(charge)}
              </p>
            )}

            <div
              className="mt-4 flex min-h-12 items-center justify-center"
              role="status"
              aria-live="polite"
            >
              {phase === 'ENTRY' && (
                <p className="text-xs text-brand-100/80">
                  Enter the amount, then send it to the terminal.
                </p>
              )}

              {phase === 'PROCESSING' && (
                <div className="flex flex-col items-center gap-2">
                  <span
                    className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden="true"
                  />
                  <p className="text-xs text-brand-100/80">
                    Ask the customer to tap, insert or swipe their card…
                  </p>
                </div>
              )}

              {phase === 'APPROVED' && (
                <div className="flex flex-col items-center gap-1.5">
                  <CheckIcon className="h-7 w-7 text-success-300" />
                  <p className="text-xs text-brand-100/80">
                    Approved · <span className="font-mono">{reference}</span>
                  </p>
                </div>
              )}

              {phase === 'DECLINED' && (
                <p className="text-xs text-danger-200">
                  The terminal refused the card. Nothing has been added to the bill.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            {phase === 'ENTRY' && (
              <>
                <div>
                  <label
                    htmlFor="card-amount"
                    className="mb-1 block text-xs font-medium text-slate-600"
                  >
                    Amount to charge (₦)
                  </label>
                  <input
                    ref={inputRef}
                    id="card-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !invalid) {
                        event.preventDefault()
                        setPhase('PROCESSING')
                      }
                    }}
                    placeholder="0.00"
                    aria-invalid={invalid}
                    aria-describedby="card-amount-help"
                    className="money min-h-12 w-full rounded-lg border border-slate-300 px-3 text-right text-lg font-semibold text-slate-900 outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15 aria-invalid:border-danger-500 aria-invalid:ring-danger-500/15"
                  />
                </div>

                {overcharge ? (
                  <p
                    id="card-amount-help"
                    className="rounded-md bg-danger-50 px-3 py-2 text-xs font-medium text-danger-800 ring-1 ring-danger-200"
                  >
                    A card cannot be charged more than the {formatNaira(chargeable)} still
                    outstanding, and a terminal cannot hand change back.
                  </p>
                ) : charge > 0 ? (
                  <p id="card-amount-help" className="text-xs text-slate-500">
                    {stillDue > 0
                      ? `${formatNaira(stillDue)} will still be outstanding afterwards.`
                      : 'This settles the bill exactly.'}
                  </p>
                ) : (
                  <p id="card-amount-help" className="text-xs text-slate-500">
                    Defaults to the full outstanding balance.
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-12 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={invalid}
                    onClick={() => setPhase('PROCESSING')}
                    className="min-h-12 flex-[2] rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    Charge {formatNaira(charge > 0 ? charge : 0)}
                  </button>
                </div>
              </>
            )}

            {phase === 'PROCESSING' && (
              <>
                <p className="text-center text-xs text-slate-500">
                  The terminal is waiting on the customer. This takes a moment.
                </p>
                {/* The decline path is chosen, never rolled. A demo that fails at
                    random is a demo that fails in the room. */}
                <button
                  type="button"
                  onClick={() => setPhase('DECLINED')}
                  className="min-h-11 w-full rounded-lg border border-dashed border-slate-300 px-4 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
                >
                  Simulate a declined card
                </button>
              </>
            )}

            {phase === 'APPROVED' && (
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 w-full rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                Done
              </button>
            )}

            {phase === 'DECLINED' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-12 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('ENTRY')}
                  className="min-h-12 flex-1 rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
