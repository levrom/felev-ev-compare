import type { CreditInput, LeaseInput } from "./calculator";

export function mergeLease(base: LeaseInput, patch: Partial<LeaseInput>): LeaseInput {
  return { ...base, ...patch };
}

export function mergeCredit(base: CreditInput, patch: Partial<CreditInput>): CreditInput {
  return { ...base, ...patch };
}
