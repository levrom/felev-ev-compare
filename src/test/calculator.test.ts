import { describe, expect, it } from "vitest";
import {
  DEFAULT_TAX_SETTINGS,
  buildCreditSchedule,
  calculateScenario,
  calculatePrivateUseTax,
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
    commuteDaysPerMonth: 0,
    commuteDaysPerMonthEnabled: false,
    annualInsuranceGross: 0,
    annualInsuranceGrossEnabled: false,
    annualChargingGross: 0,
    annualChargingGrossEnabled: false,
    annualMaintenanceGross: 0,
    annualMaintenanceGrossEnabled: false,
    annualTiresGross: 0,
    annualTiresGrossEnabled: false,
    salePriceMode: "gross" as const,
    salePriceNet: 0,
    salePriceNetEnabled: false,
    saleAfterMonths: 0,
    saleAfterMonthsEnabled: false,
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
        salePriceMode: "gross",
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

  it("calculates VAT on private use and supports the daily commute method", () => {
    const privateUse = calculatePrivateUseTax({
      ...baseCar,
      commuteDistanceKm: 20,
      commuteDistanceKmEnabled: true,
      commuteMonthsPerYear: 12,
      commuteMonthsPerYearEnabled: true,
      commuteDaysPerMonth: 10,
      commuteDaysPerMonthEnabled: true,
    });

    expect(privateUse.commuteMethod).toBe("daily");
    expect(privateUse.privateUseBenefitAnnual).toBeCloseTo(60000 * 0.0025 * 12 + 60000 * 0.0025 * 0.002 * 20 * 120);
    expect(privateUse.privateUseVatAnnual).toBeCloseTo(privateUse.privateUseBenefitAnnual * 0.19);
  });

  it("adds sale gain to the final-year taxable profit when a resale value is entered", () => {
    const scenario: ScenarioInput = {
      id: "credit-sale",
      kind: "credit-new",
      car: {
        ...baseCar,
        purchasePriceGross: 11900,
        salePriceMode: "net",
        salePriceNet: 10000,
        salePriceNetEnabled: true,
      },
      credit: {
        termMonths: 12,
        downPaymentGross: 0,
        annualInterestRate: 0,
        balloonGross: 0,
        acquisitionCostsGross: 0,
        feesGross: 0,
      },
    };

    const result = calculateScenario(scenario);
    expect(result.totalSaleGainTaxable).toBeCloseTo(1666.666666666666);
    expect(result.years[0].saleGainTaxable).toBeCloseTo(1666.666666666666);
  });

  it("interprets sale price as gross when gross mode is selected", () => {
    const scenario: ScenarioInput = {
      id: "credit-sale-gross",
      kind: "credit-new",
      car: {
        ...baseCar,
        purchasePriceGross: 11900,
        salePriceMode: "gross",
        salePriceNet: 11900,
        salePriceNetEnabled: true,
      },
      credit: {
        termMonths: 12,
        downPaymentGross: 0,
        annualInterestRate: 0,
        balloonGross: 0,
        acquisitionCostsGross: 0,
        feesGross: 0,
      },
    };

    const result = calculateScenario(scenario);
    expect(result.totalSaleGainTaxable).toBeCloseTo(1666.666666666666);
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
        commuteDaysPerMonth: 0,
        commuteDaysPerMonthEnabled: false,
        salePriceMode: "gross",
        salePriceNet: 0,
        salePriceNetEnabled: false,
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
        commuteDaysPerMonth: 0,
        commuteDaysPerMonthEnabled: false,
        salePriceMode: "gross",
        salePriceNet: 0,
        salePriceNetEnabled: false,
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
        commuteDaysPerMonth: 0,
        commuteDaysPerMonthEnabled: false,
        salePriceMode: "gross",
        salePriceNet: 0,
        salePriceNetEnabled: false,
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
    expect(result.totalNetCashOut).toBeCloseTo(12342);
    expect(result.privateUseBenefitAnnual).toBeCloseTo(1800);
    expect(result.totalPrivateUseVat).toBeCloseTo(342);
  });
});
