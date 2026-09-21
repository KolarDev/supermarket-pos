/**
 * Screens the app shell can show.
 *
 * Kept out of `pos.ts` because navigation is a shell concern, not a retail
 * domain one — nothing in the till or the ledger needs to know what a page is.
 */
export type Page = 'dashboard' | 'pos' | 'products' | 'inventory'
