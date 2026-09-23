/**
 * The shop's own identity.
 *
 * The thermal receipt and the transfer instructions both have to name the same
 * business and the same bank account, so it is written once here rather than
 * typed into two screens where the copies could quietly drift apart. The bank
 * details are fictional, but shaped like the real thing — a Nigerian current
 * account, and an account name a customer can check against the sign over the
 * door before sending money to it.
 */
export const STORE = {
  name: 'SUPERMARKET POS',
  address: '123 Commercial Avenue, Lagos',
  phone: '+234 800 123 4567',
  bank: {
    name: 'Zenith Bank',
    accountName: 'Supermarket Pos Ltd',
    accountNumber: '1012345678',
  },
} as const
