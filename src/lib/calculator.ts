export type VatMode = "regular" | "none";
export type ScenarioKind = "lease" | "credit-new" | "credit-used";
export type PrivateUseMethod = "auto-bev" | "fixed-rate";

export type CarInput = {
  name: string;
  condition: "new" | "used";
  startMonth: number;
  blpGross: number;
  purchasePriceGross: number;
  vatRate: number;
  vatMode: VatMode;
  firstRegistrationYear: number;
  afaYears: number;
  privateUseMethod: PrivateUseMethod;
  privateUseRate: number;
  commuteDistanceKm: number;
  commuteDistanceKmEnabled: boolean;
  commuteMonthsPerYear: number;
  commuteMonthsPerYearEnabled: boolean;
  annualInsuranceGross: number;
  annualInsuranceGrossEnabled: boolean;
  annualChargingGross: number;
  annualChargingGrossEnabled: boolean;
  annualMaintenanceGross: number;
  annualMaintenanceGrossEnabled: boolean;
  annualTiresGross: number;
  annualTiresGrossEnabled: boolean;
};

export type LeaseInput = {
  termMonths: number;
  monthlyRateGross: number;
  specialPaymentGross: number;
  feesGross: number;
};

export type CreditInput = {
  termMonths: number;
  downPaymentGross: number;
  annualInterestRate: number;
  balloonGross: number;
  acquisitionCostsGross: number;
  feesGross: number;
};

export type ScenarioInput = {
  id: string;
  kind: ScenarioKind;
  car: CarInput;
  lease?: LeaseInput;
  credit?: CreditInput;
};

export type TaxSettings = {
  baseAnnualProfit: number;
  corporationTaxRate: number;
  solidarityRate: number;
  gewstMeasureRate: number;
  berlinHebesatz: number;
  gewstAddbackAllowance: number;
  otherAnnualGewstAddbacks: number;
  vatRate: number;
  usedVatMode: VatMode;
  afaYears: number;
};

export type YearBreakdown = {
  year: number;
  months: number;
  grossCashOut: number;
  vorsteuer: number;
  netCashOut: number;
  deductibleExpense: number;
  afa: number;
  interest: number;
  principal: number;
  gewstAddbackBase: number;
  gewstAddback: number;
  taxableProfitAfterCar: number;
  kstSaving: number;
  soliSaving: number;
  gewstSaving: number;
  totalTaxSaving: number;
  afterTaxCost: number;
};

export type ScenarioResult = {
  id: string;
  kind: ScenarioKind;
  label: string;
  monthlyPaymentGross: number;
  totalGrossCashOut: number;
  totalVorsteuer: number;
  totalNetCashOut: number;
  totalDeductibleExpense: number;
  totalGewstAddbackBase: number;
  totalGewstAddback: number;
  gewstAddbackRate: number;
  totalTaxSaving: number;
  afterTaxTotalCost: number;
  afterTaxMonthlyEquivalent: number;
  evaluationMonths: number;
  privateUseBenefitAnnual: number;
  vatBasisForAfa: number;
  balloonGross: number;
  years: YearBreakdown[];
};

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  baseAnnualProfit: 120000,
  corporationTaxRate: 0.15,
  solidarityRate: 0.055,
  gewstMeasureRate: 0.035,
  berlinHebesatz: 410,
  gewstAddbackAllowance: 200000,
  otherAnnualGewstAddbacks: 0,
  vatRate: 0.19,
  usedVatMode: "none",
  afaYears: 6,
};

export const eur = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(round(value));

export const pct = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export function round(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function splitVat(gross: number, vatRate: number, vatMode: VatMode) {
  const normalizedGross = finiteNumber(gross, 0);
  const normalizedVatRate = finiteNumber(vatRate, 0);

  if (vatMode === "none" || normalizedVatRate <= 0) {
    return { gross: normalizedGross, vat: 0, net: normalizedGross };
  }

  const net = normalizedGross / (1 + normalizedVatRate);
  return { gross: normalizedGross, vat: normalizedGross - net, net };
}

export function resolvePrivateUseRate(car: Pick<CarInput, "blpGross" | "privateUseRate" | "privateUseMethod">) {
  const privateUseRate = finiteNumber(car.privateUseRate, 0.0025);
  const blpGross = finiteNumber(car.blpGross, 0);
  if (car.privateUseMethod !== "auto-bev") return privateUseRate;
  return blpGross <= 100000 ? 0.0025 : 0.005;
}

function normalizeStartMonth(startMonth: number) {
  if (!Number.isFinite(startMonth)) return 1;
  return Math.max(1, Math.min(12, Math.round(startMonth)));
}

export function calculateCreditPayment(
  principalGross: number,
  balloonGross: number,
  termMonths: number,
  annualInterestRate: number,
) {
  const normalizedTermMonths = Math.max(0, Math.round(finiteNumber(termMonths, 0)));
  const normalizedPrincipalGross = finiteNumber(principalGross, 0);
  const normalizedBalloonGross = finiteNumber(balloonGross, 0);
  const normalizedAnnualInterestRate = finiteNumber(annualInterestRate, 0);

  if (normalizedTermMonths <= 0) return 0;
  const monthlyRate = normalizedAnnualInterestRate / 12;
  if (monthlyRate === 0) {
    return (normalizedPrincipalGross - normalizedBalloonGross) / normalizedTermMonths;
  }

  const discountedBalloon = normalizedBalloonGross / (1 + monthlyRate) ** normalizedTermMonths;
  return (
    ((normalizedPrincipalGross - discountedBalloon) * monthlyRate) /
    (1 - (1 + monthlyRate) ** -normalizedTermMonths)
  );
}

export function buildCreditSchedule(
  principalGross: number,
  balloonGross: number,
  termMonths: number,
  annualInterestRate: number,
) {
  const paymentGross = calculateCreditPayment(
    principalGross,
    balloonGross,
    termMonths,
    annualInterestRate,
  );
  const monthlyRate = annualInterestRate / 12;
  let balance = principalGross;

  return Array.from({ length: termMonths }, (_, index) => {
    const interest = balance * monthlyRate;
    const principal = Math.min(paymentGross - interest, balance);
    balance = Math.max(0, balance - principal);
    const finalPayment = index === termMonths - 1 ? balloonGross : 0;

    return {
      month: index + 1,
      paymentGross,
      interest,
      principal,
      finalPayment,
      balance,
    };
  });
}

function monthsInYear(totalMonths: number, year: number, startMonth = 1) {
  const normalizedStartMonth = normalizeStartMonth(startMonth);
  let months = 0;

  for (let monthIndex = 0; monthIndex < Math.max(0, totalMonths); monthIndex += 1) {
    const calendarYear = Math.floor((normalizedStartMonth - 1 + monthIndex) / 12) + 1;
    if (calendarYear === year) months += 1;
  }

  return months;
}

function calendarYears(totalMonths: number, startMonth = 1) {
  if (totalMonths <= 0) return 0;
  return Math.ceil((normalizeStartMonth(startMonth) - 1 + totalMonths) / 12);
}

function annualRunningCosts(car: CarInput) {
  const vatRate = finiteNumber(car.vatRate, 0.19);
  const insurance = splitVat(
    car.annualInsuranceGrossEnabled ? finiteNumber(car.annualInsuranceGross, 0) : 0,
    vatRate,
    "none",
  );
  const charging = splitVat(
    car.annualChargingGrossEnabled ? finiteNumber(car.annualChargingGross, 0) : 0,
    vatRate,
    "regular",
  );
  const maintenance = splitVat(
    car.annualMaintenanceGrossEnabled ? finiteNumber(car.annualMaintenanceGross, 0) : 0,
    vatRate,
    "regular",
  );
  const tires = splitVat(
    car.annualTiresGrossEnabled ? finiteNumber(car.annualTiresGross, 0) : 0,
    vatRate,
    "regular",
  );

  return {
    gross: insurance.gross + charging.gross + maintenance.gross + tires.gross,
    vat: insurance.vat + charging.vat + maintenance.vat + tires.vat,
    net: insurance.net + charging.net + maintenance.net + tires.net,
  };
}

function prorateAnnualCost(value: number, activeMonths: number) {
  return finiteNumber(value, 0) * (finiteNumber(activeMonths, 0) / 12);
}

function calculateGewst(taxableProfit: number, settings: TaxSettings) {
  const roundedGewerbeertrag = Math.floor(Math.max(0, finiteNumber(taxableProfit, 0)) / 100) * 100;
  const gewstMeasureRate = finiteNumber(settings.gewstMeasureRate, DEFAULT_TAX_SETTINGS.gewstMeasureRate);
  const berlinHebesatz = finiteNumber(settings.berlinHebesatz, DEFAULT_TAX_SETTINGS.berlinHebesatz);
  return roundedGewerbeertrag * gewstMeasureRate * (berlinHebesatz / 100);
}

function calculateKst(taxableProfit: number, settings: TaxSettings) {
  return (
    Math.max(0, finiteNumber(taxableProfit, 0)) *
    finiteNumber(settings.corporationTaxRate, DEFAULT_TAX_SETTINGS.corporationTaxRate)
  );
}

function taxSaving(
  baseAnnualProfit: number,
  taxableProfitAfterCar: number,
  settings: TaxSettings,
) {
  const baseKst = calculateKst(baseAnnualProfit, settings);
  const afterKst = calculateKst(taxableProfitAfterCar, settings);
  const kstSaving = baseKst - afterKst;
  const soliSaving =
    kstSaving * finiteNumber(settings.solidarityRate, DEFAULT_TAX_SETTINGS.solidarityRate);
  const gewstSaving =
    calculateGewst(baseAnnualProfit, settings) -
    calculateGewst(taxableProfitAfterCar, settings);

  return {
    kstSaving,
    soliSaving,
    gewstSaving,
    totalTaxSaving: kstSaving + soliSaving + gewstSaving,
  };
}

function gewstAddback(currentScenarioBase: number, settings: TaxSettings) {
  const otherAnnualGewstAddbacks = Math.max(0, finiteNumber(settings.otherAnnualGewstAddbacks, 0));
  const gewstAddbackAllowance = finiteNumber(
    settings.gewstAddbackAllowance,
    DEFAULT_TAX_SETTINGS.gewstAddbackAllowance,
  );
  const before = Math.max(0, otherAnnualGewstAddbacks - gewstAddbackAllowance);
  const after = Math.max(
    0,
    otherAnnualGewstAddbacks + finiteNumber(currentScenarioBase, 0) - gewstAddbackAllowance,
  );
  return (after - before) * 0.25;
}

function normalizeScenario(scenario: ScenarioInput): ScenarioInput {
  const currentYear = new Date().getFullYear();
  const isUsed = scenario.kind === "credit-used";
  const car = {
    ...scenario.car,
    startMonth: normalizeStartMonth(scenario.car?.startMonth),
    blpGross: finiteNumber(scenario.car?.blpGross, 0),
    purchasePriceGross: finiteNumber(scenario.car?.purchasePriceGross, 0),
    vatRate: finiteNumber(scenario.car?.vatRate, 0.19),
    vatMode: scenario.car?.vatMode ?? (isUsed ? "none" : "regular"),
    firstRegistrationYear: Math.round(finiteNumber(scenario.car?.firstRegistrationYear, currentYear)),
    afaYears: Math.max(1, Math.round(finiteNumber(scenario.car?.afaYears, isUsed ? 3 : 6))),
    privateUseMethod: scenario.car?.privateUseMethod ?? "auto-bev",
    privateUseRate: finiteNumber(scenario.car?.privateUseRate, 0.0025),
    commuteDistanceKm: finiteNumber(scenario.car?.commuteDistanceKm, 0),
    commuteDistanceKmEnabled:
      typeof scenario.car?.commuteDistanceKmEnabled === "boolean"
        ? scenario.car.commuteDistanceKmEnabled
        : finiteNumber(scenario.car?.commuteDistanceKm, 0) > 0,
    commuteMonthsPerYear: finiteNumber(scenario.car?.commuteMonthsPerYear, 12),
    commuteMonthsPerYearEnabled:
      typeof scenario.car?.commuteMonthsPerYearEnabled === "boolean"
        ? scenario.car.commuteMonthsPerYearEnabled
        : finiteNumber(scenario.car?.commuteDistanceKm, 0) > 0,
    annualInsuranceGross: finiteNumber(scenario.car?.annualInsuranceGross, 0),
    annualInsuranceGrossEnabled:
      typeof scenario.car?.annualInsuranceGrossEnabled === "boolean"
        ? scenario.car.annualInsuranceGrossEnabled
        : finiteNumber(scenario.car?.annualInsuranceGross, 0) > 0,
    annualChargingGross: finiteNumber(scenario.car?.annualChargingGross, 0),
    annualChargingGrossEnabled:
      typeof scenario.car?.annualChargingGrossEnabled === "boolean"
        ? scenario.car.annualChargingGrossEnabled
        : finiteNumber(scenario.car?.annualChargingGross, 0) > 0,
    annualMaintenanceGross: finiteNumber(scenario.car?.annualMaintenanceGross, 0),
    annualMaintenanceGrossEnabled:
      typeof scenario.car?.annualMaintenanceGrossEnabled === "boolean"
        ? scenario.car.annualMaintenanceGrossEnabled
        : finiteNumber(scenario.car?.annualMaintenanceGross, 0) > 0,
    annualTiresGross: finiteNumber(scenario.car?.annualTiresGross, 0),
    annualTiresGrossEnabled:
      typeof scenario.car?.annualTiresGrossEnabled === "boolean"
        ? scenario.car.annualTiresGrossEnabled
        : finiteNumber(scenario.car?.annualTiresGross, 0) > 0,
  };

  return {
    ...scenario,
    car,
    lease: scenario.lease
      ? {
          termMonths: Math.max(1, Math.round(finiteNumber(scenario.lease.termMonths, 36))),
          monthlyRateGross: finiteNumber(scenario.lease.monthlyRateGross, 0),
          specialPaymentGross: finiteNumber(scenario.lease.specialPaymentGross, 0),
          feesGross: finiteNumber(scenario.lease.feesGross, 0),
        }
      : undefined,
    credit: scenario.credit
      ? {
          termMonths: Math.max(1, Math.round(finiteNumber(scenario.credit.termMonths, isUsed ? 36 : 48))),
          downPaymentGross: finiteNumber(scenario.credit.downPaymentGross, 0),
          annualInterestRate: finiteNumber(scenario.credit.annualInterestRate, 0),
          balloonGross: finiteNumber(scenario.credit.balloonGross, 0),
          acquisitionCostsGross: finiteNumber(scenario.credit.acquisitionCostsGross, 0),
          feesGross: finiteNumber(scenario.credit.feesGross, 0),
        }
      : undefined,
  };
}

function resultLabel(kind: ScenarioKind) {
  if (kind === "lease") return "Gewerbeleasing";
  if (kind === "credit-new") return "Ballonkredit neu";
  return "Ballonkredit gebraucht";
}

export function calculateScenario(
  scenario: ScenarioInput,
  settings: TaxSettings = DEFAULT_TAX_SETTINGS,
): ScenarioResult {
  const normalizedScenario = normalizeScenario(scenario);
  if (normalizedScenario.kind === "lease") {
    return calculateLeaseScenario(normalizedScenario, settings);
  }
  return calculateCreditScenario(normalizedScenario, settings);
}

function calculateLeaseScenario(
  scenario: ScenarioInput,
  settings: TaxSettings,
): ScenarioResult {
  if (!scenario.lease) throw new Error("Lease input is required");
  const { car, lease } = scenario;
  const monthly = splitVat(lease.monthlyRateGross, car.vatRate, "regular");
  const special = splitVat(lease.specialPaymentGross, car.vatRate, "regular");
  const fees = splitVat(lease.feesGross, car.vatRate, "regular");
  const runningCosts = annualRunningCosts(car);
  const totalYears = calendarYears(lease.termMonths, car.startMonth);

  const years = Array.from({ length: totalYears }, (_, index): YearBreakdown => {
    const year = index + 1;
    const months = monthsInYear(lease.termMonths, year, car.startMonth);
    const firstYearNet = year === 1 ? special.net + fees.net : 0;
    const firstYearGross = year === 1 ? special.gross + fees.gross : 0;
    const firstYearVat = year === 1 ? special.vat + fees.vat : 0;
    const runningGross = prorateAnnualCost(runningCosts.gross, months);
    const runningVat = prorateAnnualCost(runningCosts.vat, months);
    const runningNet = prorateAnnualCost(runningCosts.net, months);
    const leasePaymentNet = monthly.net * months + (year === 1 ? special.net : 0);
    const grossCashOut = monthly.gross * months + firstYearGross + runningGross;
    const vorsteuer = monthly.vat * months + firstYearVat + runningVat;
    const deductibleExpense = monthly.net * months + firstYearNet + runningNet;
    const gewstAddbackBase = leasePaymentNet * 0.1;
    const addback = gewstAddback(gewstAddbackBase, settings);
    const taxableProfitAfterCar =
      settings.baseAnnualProfit - deductibleExpense + addback;
    const taxes = taxSaving(settings.baseAnnualProfit, taxableProfitAfterCar, settings);

    return {
      year,
      months,
      grossCashOut,
      vorsteuer,
      netCashOut: grossCashOut - vorsteuer,
      deductibleExpense,
      afa: 0,
      interest: 0,
      principal: 0,
      gewstAddbackBase,
      gewstAddback: addback,
      taxableProfitAfterCar,
      ...taxes,
      afterTaxCost: grossCashOut - vorsteuer - taxes.totalTaxSaving,
    };
  });

  return summarizeScenario(scenario, years, monthly.gross, 0);
}

function calculateCreditScenario(
  scenario: ScenarioInput,
  settings: TaxSettings,
): ScenarioResult {
  if (!scenario.credit) throw new Error("Credit input is required");
  const { car, credit } = scenario;
  const purchase = splitVat(car.purchasePriceGross, car.vatRate, car.vatMode);
  const acquisitionCosts = splitVat(credit.acquisitionCostsGross, car.vatRate, "regular");
  const fees = splitVat(credit.feesGross, car.vatRate, "regular");
  const runningCosts = annualRunningCosts(car);
  const financedPrincipal = Math.max(
    0,
    car.purchasePriceGross - credit.downPaymentGross,
  );
  const schedule = buildCreditSchedule(
    financedPrincipal,
    credit.balloonGross,
    credit.termMonths,
    credit.annualInterestRate,
  );
  const afaYears = scenario.kind === "credit-new" ? 6 : Math.max(1, car.afaYears);
  const afaMonths = afaYears * 12;
  const evaluationMonths = Math.max(credit.termMonths, afaMonths);
  const afaBasis = purchase.net + acquisitionCosts.net;
  const annualAfa = afaBasis / afaYears;
  const totalYears = Math.max(
    calendarYears(credit.termMonths, car.startMonth),
    calendarYears(afaMonths, car.startMonth),
  );
  const paymentGross = schedule[0]?.paymentGross ?? 0;

  const years = Array.from({ length: totalYears }, (_, index): YearBreakdown => {
    const year = index + 1;
    const months = monthsInYear(credit.termMonths, year, car.startMonth);
    const ownershipMonths = monthsInYear(evaluationMonths, year, car.startMonth);
    const afaActiveMonths = monthsInYear(afaMonths, year, car.startMonth);
    const elapsedLoanMonthsBeforeYear = Array.from({ length: year - 1 }, (_, priorIndex) =>
      monthsInYear(credit.termMonths, priorIndex + 1, car.startMonth),
    ).reduce((sum, count) => sum + count, 0);
    const yearSchedule = schedule.slice(elapsedLoanMonthsBeforeYear, elapsedLoanMonthsBeforeYear + months);
    const interest = yearSchedule.reduce((sum, row) => sum + row.interest, 0);
    const principal = yearSchedule.reduce((sum, row) => sum + row.principal, 0);
    const finalPayment = yearSchedule.reduce((sum, row) => sum + row.finalPayment, 0);
    const firstYearCash = year === 1 ? credit.downPaymentGross + acquisitionCosts.gross + fees.gross : 0;
    const firstYearVat = year === 1 ? purchase.vat + acquisitionCosts.vat + fees.vat : 0;
    const runningGross = prorateAnnualCost(runningCosts.gross, ownershipMonths);
    const runningVat = prorateAnnualCost(runningCosts.vat, ownershipMonths);
    const runningNet = prorateAnnualCost(runningCosts.net, ownershipMonths);
    const afa = annualAfa * (afaActiveMonths / 12);
    const grossCashOut = paymentGross * months + finalPayment + firstYearCash + runningGross;
    const deductibleExpense = interest + afa + runningNet;
    const gewstAddbackBase = interest;
    const addback = gewstAddback(gewstAddbackBase, settings);
    const taxableProfitAfterCar =
      settings.baseAnnualProfit - deductibleExpense + addback;
    const taxes = taxSaving(settings.baseAnnualProfit, taxableProfitAfterCar, settings);

    return {
      year,
      months,
      grossCashOut,
      vorsteuer: firstYearVat + runningVat,
      netCashOut: grossCashOut - firstYearVat - runningVat,
      deductibleExpense,
      afa,
      interest,
      principal,
      gewstAddbackBase,
      gewstAddback: addback,
      taxableProfitAfterCar,
      ...taxes,
      afterTaxCost: grossCashOut - firstYearVat - runningVat - taxes.totalTaxSaving,
    };
  });

  return summarizeScenario(scenario, years, paymentGross, afaBasis);
}

function summarizeScenario(
  scenario: ScenarioInput,
  years: YearBreakdown[],
  monthlyPaymentGross: number,
  vatBasisForAfa: number,
): ScenarioResult {
  const totalGrossCashOut = years.reduce((sum, row) => sum + row.grossCashOut, 0);
  const totalVorsteuer = years.reduce((sum, row) => sum + row.vorsteuer, 0);
  const totalNetCashOut = years.reduce((sum, row) => sum + row.netCashOut, 0);
  const totalDeductibleExpense = years.reduce(
    (sum, row) => sum + row.deductibleExpense,
    0,
  );
  const totalGewstAddbackBase = years.reduce((sum, row) => sum + row.gewstAddbackBase, 0);
  const totalGewstAddback = years.reduce((sum, row) => sum + row.gewstAddback, 0);
  const totalTaxSaving = years.reduce((sum, row) => sum + row.totalTaxSaving, 0);
  const termMonths =
    scenario.kind === "lease"
      ? scenario.lease?.termMonths ?? 1
      : scenario.credit?.termMonths ?? 1;
  const afaMonths = scenario.kind === "lease" ? 0 : Math.max(1, scenario.car.afaYears) * 12;
  const evaluationMonths = scenario.kind === "lease" ? termMonths : Math.max(termMonths, afaMonths);
  const privateUseRate = resolvePrivateUseRate(scenario.car);
  const commuteMonths = scenario.car.commuteMonthsPerYearEnabled
    ? Math.max(0, Math.min(12, scenario.car.commuteMonthsPerYear))
    : 0;
  const commuteDistanceKm = scenario.car.commuteDistanceKmEnabled
    ? Math.max(0, scenario.car.commuteDistanceKm)
    : 0;
  const commuteBenefitAnnual =
    scenario.car.blpGross * privateUseRate * 0.03 * commuteDistanceKm * commuteMonths;

  return {
    id: scenario.id,
    kind: scenario.kind,
    label: resultLabel(scenario.kind),
    monthlyPaymentGross,
    totalGrossCashOut,
    totalVorsteuer,
    totalNetCashOut,
    totalDeductibleExpense,
    totalGewstAddbackBase,
    totalGewstAddback,
    gewstAddbackRate: totalDeductibleExpense > 0 ? totalGewstAddback / totalDeductibleExpense : 0,
    totalTaxSaving,
    afterTaxTotalCost: totalNetCashOut - totalTaxSaving,
    afterTaxMonthlyEquivalent: (totalNetCashOut - totalTaxSaving) / evaluationMonths,
    evaluationMonths,
    privateUseBenefitAnnual: scenario.car.blpGross * privateUseRate * 12 + commuteBenefitAnnual,
    vatBasisForAfa,
    balloonGross: scenario.credit?.balloonGross ?? 0,
    years,
  };
}
