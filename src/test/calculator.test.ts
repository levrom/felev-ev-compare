import { describe, expect, it } from "vitest";
import {
  DEFAULT_TAX_SETTINGS,
  buildCreditSchedule,
  calculateScenario,
  splitVat,
  resolvePrivateUseRate,
  type ScenarioInput,
} from "../lib/calculator";

describe("VAT handling", () => {
  it("splits regular VAT from gross amounts", () => {
    const result = splitVat(11900, 0.19, "regular");
    expect(result.net).toBeCloseTo(10000);
    expect(result.vat).toBeCloseTo(1900);
  });

  it("uses gross as acquisition cost when VAT is not deductible", () => {
    const result = splitVat(11900, 0.19, "none");
    expect(result.net).toBe(11900);
    expect(result.vat).toBe(0);
  });
});

describe("credit schedule", () => {
  it("keeps the balloon amount for the final payment", () => {
    const schedule = buildCreditSchedule(40000, 15000, 36, 0.06);
    expect(schedule).toHaveLength(36);
    expect(schedule[35].finalPayment).toBe(15000);
    expect(schedule[0].interest).toBeCloseTo(200);
  });
});

describe("scenario calculations", () => {
  const baseCar = {
    name: "Test EV",
    condition: "new" as const,
    startMonth: 1,
    blpGross: 60000,
    purchasePriceGross: 59500,
    vatRate: 0.19,
    vatMode: "regular" as const,
    firstRegistrationYear: 2026,
    afaYears: 6,
    privateUseMethod: "auto-bev" as const,
    privateUseRate: 0.0025,
    commuteDistanceKm: 0,
    commuteDistanceKmEnabled: false,
    commuteMonthsPerYear: 12,
    commuteMonthsPerYearEnabled: false,
    annualInsuranceGross: 0,
    annualInsuranceGrossEnabled: false,
    annualChargingGross: 0,
    annualChargingGrossEnabled: false,
    annualMaintenanceGross: 0,
    annualMaintenanceGrossEnabled: false,
    annualTiresGross: 0,
    annualTiresGrossEnabled: false,
  };

  it("recovers purchase VAT for a new car and keeps VAT out of AfA", () => {
    const scenario: ScenarioInput = {
      id: "new-credit",
      kind: "credit-new",
      car: baseCar,
      credit: {
        termMonths: 48,
        downPaymentGross: 5000,
        annualInterestRate: 0.05,
        balloonGross: 20000,
        acquisitionCostsGross: 0,
        feesGross: 0,
      },
    };

    const result = calculateScenario(scenario);
    expect(result.totalVorsteuer).toBeCloseTo(9500);
    expect(result.vatBasisForAfa).toBeCloseTo(50000);
    expect(result.years[0].afa).toBeCloseTo(50000 / 6);
  });

  it("uses gross used-car price for AfA when VAT cannot be deducted", () => {
    const scenario: ScenarioInput = {
      id: "used-credit",
      kind: "credit-used",
      car: {
        ...baseCar,
        condition: "used",
        purchasePriceGross: 30000,
        vatMode: "none",
        afaYears: 3,
      },
      credit: {
        termMonths: 36,
        downPaymentGross: 5000,
        annualInterestRate: 0.05,
        balloonGross: 10000,
        acquisitionCostsGross: 0,
        feesGross: 0,
      },
    };

    const result = calculateScenario(scenario);
    expect(result.totalVorsteuer).toBe(0);
    expect(result.vatBasisForAfa).toBe(30000);
    expect(result.years[0].afa).toBe(10000);
  });

  it("applies the Berlin Gewerbesteuer rate", () => {
    const scenario: ScenarioInput = {
      id: "lease",
      kind: "lease",
      car: baseCar,
      lease: {
        termMonths: 12,
        monthlyRateGross: 1190,
        specialPaymentGross: 0,
        feesGross: 0,
      },
    };

    const result = calculateScenario(scenario, {
      ...DEFAULT_TAX_SETTINGS,
      baseAnnualProfit: 100000,
    });

    const expectedGewstSaving = 12000 * 0.035 * 4.1;
    expect(result.years[0].gewstSaving).toBeCloseTo(expectedGewstSaving);
  });

  it("rounds Gewerbeertrag down to full hundreds before calculating GewSt", () => {
    const scenario: ScenarioInput = {
      id: "lease-rounding",
      kind: "lease",
      car: {
        ...baseCar,
        purchasePriceGross: 17,
        vatRate: 0,
        vatMode: "none",
      },
      lease: {
        termMonths: 1,
        monthlyRateGross: 17,
        specialPaymentGross: 0,
        feesGross: 0,
      },
    };

    const result = calculateScenario(scenario, {
      ...DEFAULT_TAX_SETTINGS,
      baseAnnualProfit: 100123,
    });

    expect(result.years[0].taxableProfitAfterCar).toBe(100106);
    expect(result.years[0].gewstSaving).toBeCloseTo(0);
  });

  it("only applies GewSt addback above the 200000 allowance", () => {
    const scenario: ScenarioInput = {
      id: "lease",
      kind: "lease",
      car: baseCar,
      lease: {
        termMonths: 12,
        monthlyRateGross: 11900,
        specialPaymentGross: 0,
        feesGross: 0,
      },
    };

    const result = calculateScenario(scenario, {
      ...DEFAULT_TAX_SETTINGS,
      otherAnnualGewstAddbacks: 199000,
    });
    expect(result.years[0].gewstAddbackBase).toBeCloseTo(12000);
    expect(result.years[0].gewstAddback).toBeCloseTo(2750);
  });

  it("uses the legal BEV private-use rate automatically", () => {
    expect(
      resolvePrivateUseRate({
        blpGross: 60000,
        privateUseMethod: "auto-bev",
        privateUseRate: 0.001,
      }),
    ).toBeCloseTo(0.0025);

    expect(
      resolvePrivateUseRate({
        blpGross: 120000,
        privateUseMethod: "auto-bev",
        privateUseRate: 0.001,
      }),
    ).toBeCloseTo(0.005);

    expect(
      resolvePrivateUseRate({
        blpGross: 120000,
        privateUseMethod: "fixed-rate",
        privateUseRate: 0.001,
      }),
    ).toBeCloseTo(0.001);
  });

  it("reports the credit horizon over finance term or depreciation horizon", () => {
    const scenario: ScenarioInput = {
      id: "credit-horizon",
      kind: "credit-new",
      car: {
        ...baseCar,
        privateUseMethod: "auto-bev",
      },
      credit: {
        termMonths: 48,
        downPaymentGross: 5000,
        annualInterestRate: 0.05,
        balloonGross: 20000,
        acquisitionCostsGross: 0,
        feesGross: 0,
      },
    };

    const result = calculateScenario(scenario);
    expect(result.evaluationMonths).toBe(72);
  });

  it("adds running costs as deductible expenses and recovers VAT where invoiced", () => {
    const scenario: ScenarioInput = {
      id: "lease-running-costs",
      kind: "lease",
      car: {
        ...baseCar,
        annualInsuranceGross: 1200,
        annualInsuranceGrossEnabled: true,
        annualChargingGross: 1190,
        annualChargingGrossEnabled: true,
        annualMaintenanceGross: 0,
        annualTiresGross: 0,
      },
      lease: {
        termMonths: 12,
        monthlyRateGross: 0,
        specialPaymentGross: 0,
        feesGross: 0,
      },
    };

    const result = calculateScenario(scenario);
    expect(result.totalGrossCashOut).toBeCloseTo(2390);
    expect(result.totalVorsteuer).toBeCloseTo(190);
    expect(result.totalDeductibleExpense).toBeCloseTo(2200);
    expect(result.totalGewstAddbackBase).toBeCloseTo(0);
  });

  it("prorates AfA and running costs by start month", () => {
    const scenario: ScenarioInput = {
      id: "credit-start-month",
      kind: "credit-new",
      car: {
        ...baseCar,
        startMonth: 7,
        annualInsuranceGross: 1200,
        annualInsuranceGrossEnabled: true,
      },
      credit: {
        termMonths: 12,
        downPaymentGross: 5000,
        annualInterestRate: 0,
        balloonGross: 0,
        acquisitionCostsGross: 0,
        feesGross: 0,
      },
    };

    const result = calculateScenario(scenario);
    expect(result.years[0].months).toBe(6);
    expect(result.years[0].afa).toBeCloseTo((50000 / 6) * 0.5);
    expect(result.years[0].deductibleExpense).toBeGreaterThan(result.years[0].afa);
  });

  it("keeps core calculations working when optional enrichment fields are missing", () => {
    const scenario = {
      id: "legacy-lease",
      kind: "lease",
      car: {
        name: "Legacy EV",
        condition: "new",
        startMonth: 1,
        blpGross: 60000,
        purchasePriceGross: 59500,
        vatRate: 0.19,
        vatMode: "regular",
        firstRegistrationYear: 2026,
      },
      lease: {
        termMonths: 12,
        monthlyRateGross: 1190,
        specialPaymentGross: 0,
        feesGross: 0,
      },
    } as ScenarioInput;

    const result = calculateScenario(scenario);
    expect(result.totalGrossCashOut).toBeCloseTo(14280);
    expect(result.totalVorsteuer).toBeCloseTo(2280);
    expect(result.totalNetCashOut).toBeCloseTo(12000);
    expect(result.privateUseBenefitAnnual).toBeCloseTo(1800);
  });
});
