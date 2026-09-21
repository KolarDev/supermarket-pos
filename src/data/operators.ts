import type { UserRole } from '../types/pos'

/**
 * The till's two demo operators.
 *
 * Kept in one module because both the sale receipt (`completeSale`) and the
 * stock audit log (`adjustStock`) need to attribute an action to a person —
 * hardcoding the name in either caller lets them drift apart.
 */
export const OPERATOR_NAMES: Record<UserRole, string> = {
  Cashier: 'Ngozi Okafor',
  Manager: 'Emeka Balogun',
}

export const getOperatorName = (role: UserRole): string => OPERATOR_NAMES[role]
