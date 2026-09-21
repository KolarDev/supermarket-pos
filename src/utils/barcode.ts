/**
 * In-store barcode allocation.
 *
 * GS1 reserves every number beginning with `2` for restricted-circulation
 * codes — the ones a store mints itself for loose goods, repacks and own-brand
 * lines. Using that range guarantees an in-store code can never collide with a
 * manufacturer's EAN-13, which is the whole point: a scanner must resolve to
 * exactly one product.
 *
 * The seeded crate of eggs already carries one (`200000017538`), so the
 * allocator continues from whatever is in the catalogue rather than restarting
 * at one.
 */

/** GS1 reserved prefix for in-store / restricted-circulation numbers. */
const INTERNAL_PREFIX = '200'

/** `200` + a 9-digit sequence + check digit = a 13-digit EAN-13. */
const SEQUENCE_LENGTH = 9
const EAN13_LENGTH = 13

/**
 * GS1 mod-10 check digit over the first twelve digits, weighted 1,3,1,3…
 *
 * Worth computing rather than randomising: most retail scanners validate the
 * checksum before they report a read, so an internal code without one would
 * fail at the till and read as a broken scanner.
 */
function checkDigit(digits: string): number {
  let sum = 0
  for (let index = 0; index < digits.length; index += 1) {
    sum += Number(digits[index]) * (index % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

/**
 * The next free in-store barcode for a catalogue.
 *
 * Sequential rather than random: two operators adding products at the same
 * till cannot be handed the same code, and a shelf label printed last month
 * still reads in the same series as one printed today.
 */
export function nextInternalBarcode(existing: readonly string[]): string {
  const highest = existing.reduce((max, code) => {
    // Only codes in the format this allocator mints are counted, so a
    // hand-entered code of some other length cannot shift the sequence.
    if (!code.startsWith(INTERNAL_PREFIX) || code.length !== EAN13_LENGTH) return max
    const sequence = code.slice(INTERNAL_PREFIX.length, EAN13_LENGTH - 1)
    if (!/^\d+$/.test(sequence)) return max
    return Math.max(max, Number(sequence))
  }, 0)

  const body = INTERNAL_PREFIX + String(highest + 1).padStart(SEQUENCE_LENGTH, '0')
  return body + String(checkDigit(body))
}
