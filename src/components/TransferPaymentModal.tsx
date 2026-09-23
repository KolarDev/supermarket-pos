import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BankIcon, CheckIcon, CloseIcon, CopyIcon, VerifiedIcon } from './Icons'
import { STORE } from '../data/store'
import { formatNaira } from '../utils/format'
import { round2 } from '../utils/money'
import { makeTransferReference, maxChargeable } from '../utils/payments'

interface TransferPaymentModalProps {
  /** The grand total being settled, so the dialog can price what is left of it. */
  total: number
  /** Already taken on cash and card — what the transfer must not duplicate. */
  paidElsewhere: number
  /** Already on the transfer, when the operator is reopening to correct it. */
  recorded: number
  /** Called once, on confirmation, with the amount and the quoted reference. */
  onConfirm: (amount: number, reference: string) => void
  onClose: () => void
}

/**
 * How long the "ledger check" takes.
 *
 * An instant transfer is not instant on the receiving end — the sim waits just
 * long enough for the operator to read the status line, without turning a demo
 * into a queue.
 */
const VERIFYING_MS = 1600

type Phase = 'ENTRY' | 'VERIFYING' | 'CONFIRMED'

/** One row of the account panel: a label, and the value read down a phone. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

/**
 * The bank transfer confirmation dialog.
 *
 * A transfer is the one tender the till cannot initiate: the customer sends the
 * money from their own bank app, and the operator can only record that it
 * arrived. So the dialog leads with what the customer needs to *send* — bank,
 * account, and a reference to quote in the narration — then takes the amount
 * actually paid and runs it past a simulated ledger check before it counts
 * toward the bill.
 *
 * Nothing here is applied until that check returns, which is the same rule the
 * card terminal follows: a payment that has not been seen by the ledger is not
 * money in the drawer.
 */
export function TransferPaymentModal({
  total,
  paidElsewhere,
  recorded,
  onConfirm,
  onClose,
}: TransferPaymentModalProps) {
  /** The most this transfer may cover: the bill, less what is already paid. */
  const chargeable = maxChargeable(total, paidElsewhere)

  /** Minted on open — the customer is looking at it before any money moves. */
  const [reference] = useState(makeTransferReference)
  const [amount, setAmount] = useState(() =>
    String(recorded > 0 ? recorded : chargeable > 0 ? chargeable : ''),
  )
  const [phase, setPhase] = useState<Phase>('ENTRY')
  const [copied, setCopied] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  /** Confirmation must land on the bill exactly once, whatever React re-runs. */
  const appliedRef = useRef(false)

  const parsed = Number.parseFloat(amount)
  const payment = Number.isFinite(parsed) ? round2(parsed) : 0
  const overpaid = payment > chargeable
  const invalid = payment <= 0 || overpaid

  /** What would still be owed once this transfer lands. */
  const stillDue = round2(Math.max(0, round2(total - paidElsewhere - payment)))

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape closes — but not mid-verification, when the ledger is being asked
  // about a payment the operator has already told the customer to send.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phase !== 'VERIFYING') {
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
    if (phase !== 'VERIFYING') return
    const timer = window.setTimeout(() => setPhase('CONFIRMED'), VERIFYING_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'CONFIRMED' || appliedRef.current) return
    appliedRef.current = true
    onConfirm(payment, reference)
  }, [phase, payment, reference, onConfirm])

  // The "Copied" tick reverts on its own, so nobody is left wondering whether
  // the button still works the second time they press it.
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText(STORE.bank.accountNumber)
      setCopied(true)
    } catch {
      // Clipboard blocked (insecure context, denied permission). The digits are
      // on screen either way — the operator can read them out.
      setCopied(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm print:hidden"
      onClick={() => phase !== 'VERIFYING' && onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="mx-auto flex min-h-full max-w-md items-center justify-center"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Bank transfer payment"
      >
        <div className="w-full overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-300">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
                <BankIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Bank Transfer</h2>
                <p className="text-xs text-slate-500">
                  {formatNaira(chargeable)} outstanding · send to {STORE.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={phase === 'VERIFYING'}
              aria-label="Close"
              className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </header>

          <div className="space-y-4 px-5 py-5">
            {/* ------------------------------------------ where the money goes */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Send payment to
                </p>
                <button
                  type="button"
                  onClick={copyAccountNumber}
                  className="flex min-h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  {copied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-success-600" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <dl className="space-y-1.5">
                <Detail label="Bank" value={STORE.bank.name} />
                <Detail label="Account name" value={STORE.bank.accountName} />
                <Detail label="Account number" value={STORE.bank.accountNumber} />
              </dl>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-brand-900 px-3 py-2 text-white">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-brand-100/70">
                    Reference code
                  </p>
                  <p className="truncate font-mono text-sm font-bold tracking-[0.14em]">
                    {reference}
                  </p>
                </div>
                <p className="max-w-[9rem] text-right text-[10px] leading-snug text-brand-100/80">
                  Quote this in the transfer narration.
                </p>
              </div>
            </div>

            {/* --------------------------------------------- what was received */}
            {phase === 'ENTRY' && (
              <>
                <div>
                  <label
                    htmlFor="transfer-amount"
                    className="mb-1 block text-xs font-medium text-slate-600"
                  >
                    Amount paid by transfer (₦)
                  </label>
                  <input
                    ref={inputRef}
                    id="transfer-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !invalid) {
                        event.preventDefault()
                        setPhase('VERIFYING')
                      }
                    }}
                    placeholder="0.00"
                    aria-invalid={invalid}
                    aria-describedby="transfer-amount-help"
                    className="money min-h-12 w-full rounded-lg border border-slate-300 px-3 text-right text-lg font-semibold text-slate-900 outline-none transition focus:border-brand-900 focus:ring-2 focus:ring-brand-900/15 aria-invalid:border-danger-500 aria-invalid:ring-danger-500/15"
                  />
                </div>

                {overpaid ? (
                  <p
                    id="transfer-amount-help"
                    className="rounded-md bg-danger-50 px-3 py-2 text-xs font-medium text-danger-800 ring-1 ring-danger-200"
                  >
                    A transfer cannot cover more than the {formatNaira(chargeable)} still
                    outstanding on this bill.
                  </p>
                ) : payment > 0 ? (
                  <p id="transfer-amount-help" className="text-xs text-slate-500">
                    {stillDue > 0
                      ? `${formatNaira(stillDue)} will still be outstanding afterwards.`
                      : 'This settles the bill exactly.'}
                  </p>
                ) : (
                  <p id="transfer-amount-help" className="text-xs text-slate-500">
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
                    onClick={() => setPhase('VERIFYING')}
                    className="min-h-12 flex-[2] rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    Confirm Transfer Received
                  </button>
                </div>
              </>
            )}

            {/* ------------------------------------- the simulated ledger check */}
            {phase === 'VERIFYING' && (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center"
              >
                <span
                  className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-900"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-slate-800">Checking the ledger…</p>
                <p className="text-xs text-slate-500">
                  Matching {formatNaira(payment)} against <span className="font-mono">{reference}</span>{' '}
                  on {STORE.bank.name}.
                </p>
              </div>
            )}

            {phase === 'CONFIRMED' && (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center gap-2 rounded-lg bg-success-50 px-4 py-6 text-center ring-1 ring-success-200"
              >
                <VerifiedIcon className="h-8 w-8 text-success-700" />
                <p className="text-sm font-semibold text-success-800">Transfer confirmed</p>
                <p className="money text-lg font-bold text-success-800">{formatNaira(payment)}</p>
                <p className="font-mono text-[11px] text-success-700">{reference}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 min-h-12 w-full rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
                >
                  Done
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
