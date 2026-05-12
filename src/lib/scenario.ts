import type { CreditInput, LeaseInput } from "./calculator";

export function mergeLease(base: LeaseInput, patch: Partial<LeaseInput>): LeaseInput {
  return { ...base, ...patch };
}

export function mergeCredit(base: CreditInput, patch: Partial<CreditInput>): CreditInput {
  return { ...base, ...patch };
}

export function scenarioTitle(
  kind: "lease" | "credit-new" | "credit-used",
  ui: {
    scenarioKinds: {
      lease: string;
      creditNew: string;
      creditUsed: string;
    };
    scenarioSummaries: {
      lease: string;
      creditNew: string;
      creditUsed: string;
    };
  },
  mode: "kind" | "summary" = "kind",
) {
  if (mode === "summary") {
    return kind === "lease"
      ? ui.scenarioSummaries.lease
      : kind === "credit-new"
        ? ui.scenarioSummaries.creditNew
        : ui.scenarioSummaries.creditUsed;
  }

  return kind === "lease"
    ? ui.scenarioKinds.lease
    : kind === "credit-new"
      ? ui.scenarioKinds.creditNew
      : ui.scenarioKinds.creditUsed;
}
