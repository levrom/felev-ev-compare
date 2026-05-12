import { X } from "lucide-react";
import { useState } from "react";
import type { UiText } from "../App";
import { normalizeMonthKey, addMonthsToMonthKey } from "../lib/dates";
import { calculateScenario, eur, pct, type ScenarioInput } from "../lib/calculator";
import { BreakdownValue, formatTaxNote, taxBreakdownTooltip } from "./fields";

export type ScenarioResult = ReturnType<typeof calculateScenario>;

export function CompareModal({
  open,
  scenarios,
  results,
  comparisonStartMonth,
  onClose,
  ui,
}: {
  open: boolean;
  scenarios: ScenarioInput[];
  results: ScenarioResult[];
  comparisonStartMonth: string;
  onClose: () => void;
  ui: UiText;
}) {
  const [compareMode, setCompareMode] = useState<"year" | "month">("year");
  if (!open) return null;

  const maxYears = Math.max(...results.map((result) => result.years.length), 0);
  const maxMonths = Math.max(...results.map((result) => result.months.length), 0);
  const rowCount = compareMode === "year" ? maxYears : maxMonths;
  const comparisonStartMonthKey = normalizeMonthKey(comparisonStartMonth);
  const bestResultId = results.reduce<ScenarioResult | undefined>((best, current) => {
    if (!best || current.afterTaxTotalCost < best.afterTaxTotalCost) return current;
    return best;
  }, undefined)?.id;
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario] as const));

  const totalRows: Array<{
    label: string;
    render: (result: ScenarioResult, scenario?: ScenarioInput) => string;
    breakdown?: (result: ScenarioResult) => { note?: string; tooltip: string };
  }> = [
    {
      label: ui.compareRows.afterTaxMonth,
      render: (result) => eur(result.afterTaxMonthlyEquivalent),
      breakdown: (result) => ({
        note: formatTaxNote(result.totalTaxSaving / Math.max(1, result.evaluationMonths), ui),
        tooltip: taxBreakdownTooltip({
          beforeTaxLabel: ui.summary.beforeTaxEquivalent,
          beforeTax: result.totalNetCashOut / Math.max(1, result.evaluationMonths),
          taxSavingLabel: ui.summary.taxSavingMonthly,
          taxSaving: result.totalTaxSaving / Math.max(1, result.evaluationMonths),
          afterTaxLabel: ui.compareRows.afterTaxMonth,
          afterTax: result.afterTaxMonthlyEquivalent,
          kstSaving: result.totalKstSaving / Math.max(1, result.evaluationMonths),
          soliSaving: result.totalSoliSaving / Math.max(1, result.evaluationMonths),
          gewstSaving: result.totalGewstSaving / Math.max(1, result.evaluationMonths),
        }),
      }),
    },
    {
      label: ui.compareRows.leasingFactor,
      render: (_result, scenario) => {
        if (!scenario || scenario.kind !== "lease" || !scenario.lease || scenario.car.blpGross <= 0) return "–";
        return pct(scenario.lease.monthlyRateGross / scenario.car.blpGross);
      },
    },
    {
      label: ui.compareRows.averageMonthlyGross,
      render: (_result, scenario) => {
        if (!scenario || scenario.kind !== "lease" || !scenario.lease) return "–";
        const termMonths = Math.max(1, Math.round(scenario.lease.termMonths || 0));
        const allInMonthlyGross =
          (scenario.lease.monthlyRateGross * termMonths +
            scenario.lease.specialPaymentGross +
            scenario.lease.feesGross) /
          termMonths;
        return eur(allInMonthlyGross);
      },
    },
    { label: ui.compareRows.totalGross, render: (result) => eur(result.totalGrossCashOut) },
    { label: ui.compareRows.vorsteuer, render: (result) => eur(result.totalVorsteuer) },
    { label: ui.compareRows.netCash, render: (result) => eur(result.totalNetCashOut) },
    { label: ui.compareRows.deductible, render: (result) => eur(result.totalDeductibleExpense) },
    { label: ui.compareRows.gewstAddback, render: (result) => eur(result.totalGewstAddback) },
    { label: ui.compareRows.gewstAddbackRate, render: (result) => pct(result.gewstAddbackRate) },
    {
      label: ui.compareRows.taxSaving,
      render: (result) => eur(result.totalTaxSaving),
      breakdown: (result) => ({
        tooltip: taxBreakdownTooltip({
          beforeTaxLabel: ui.summary.beforeTaxEquivalent,
          beforeTax: result.totalNetCashOut,
          taxSavingLabel: ui.compareRows.taxSaving,
          taxSaving: result.totalTaxSaving,
          afterTaxLabel: ui.compareRows.afterTaxMonth,
          afterTax: result.afterTaxTotalCost,
          kstSaving: result.totalKstSaving,
          soliSaving: result.totalSoliSaving,
          gewstSaving: result.totalGewstSaving,
        }),
      }),
    },
    { label: ui.compareRows.benefitPa, render: (result) => eur(result.privateUseBenefitAnnual) },
  ];

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label={ui.sections.compare}>
      <div className="modalShell modalShellWide">
        <div className="modalHeader">
          <div>
            <h2>{ui.sections.compare}</h2>
            <p>{ui.modals.compareDescription}</p>
          </div>
          <div className="compareHeaderActions">
            <div className="compareModeSwitch" role="group" aria-label={ui.sections.compare}>
              <button
                type="button"
                className={compareMode === "year" ? "compareModeButton active" : "compareModeButton"}
                aria-pressed={compareMode === "year"}
                onClick={() => setCompareMode("year")}
              >
                {ui.compareModes.year}
              </button>
              <button
                type="button"
                className={compareMode === "month" ? "compareModeButton active" : "compareModeButton"}
                aria-pressed={compareMode === "month"}
                onClick={() => setCompareMode("month")}
              >
                {ui.compareModes.month}
              </button>
            </div>
            <button className="iconButton" onClick={onClose} aria-label={ui.modals.closeCompare}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="compareBody">
          <section className="panel">
            <h3>{compareMode === "year" ? ui.sections.byYear : ui.sections.byMonth}</h3>
            <div className="tableScroll">
              <table className="compareTable compareUnifiedTable">
                <thead>
                  <tr>
                    <th>{compareMode === "year" ? ui.compareRows.year : ui.compareRows.month}</th>
                    {results.map((result) => {
                      const scenario = scenarios.find((item) => item.id === result.id);
                      return (
                        <th key={result.id}>
                          <div className="compareHeaderCell">
                            <span className={result.id === bestResultId ? "bestScenarioName" : undefined}>
                              {scenario?.car.name ?? result.label}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }, (_, index) => index + 1).map((rowNumber) => {
                    const rowLabel =
                      compareMode === "year"
                        ? String(rowNumber)
                        : `${rowNumber} - ${addMonthsToMonthKey(comparisonStartMonthKey, rowNumber - 1)}`;
                    return (
                      <tr key={rowNumber}>
                        <td>{rowLabel}</td>
                        {results.map((result) => {
                          const item =
                            compareMode === "year" ? result.years[rowNumber - 1] : result.months[rowNumber - 1];
                          return (
                            <td key={result.id}>
                              {item ? (
                                <BreakdownValue
                                  value={eur(item.afterTaxCost)}
                                  note={formatTaxNote(item.totalTaxSaving, ui)}
                                  tooltip={taxBreakdownTooltip({
                                    beforeTaxLabel: ui.compareRows.netCash,
                                    beforeTax: item.netCashOut,
                                    taxSavingLabel: ui.compareRows.taxSaving,
                                    taxSaving: item.totalTaxSaving,
                                    afterTaxLabel: ui.compareRows.yearAfterTax,
                                    afterTax: item.afterTaxCost,
                                    kstSaving: item.kstSaving,
                                    soliSaving: item.soliSaving,
                                    gewstSaving: item.gewstSaving,
                                  })}
                                />
                              ) : (
                                "–"
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="totalsSeparator">
                    <td colSpan={scenarios.length + 1} />
                  </tr>
                  {totalRows.map((row) => (
                    <tr className="totalRow" key={row.label}>
                      <td>{row.label}</td>
                      {results.map((result) => {
                        const value = row.render(result, scenarioById.get(result.id));
                        const breakdown = row.breakdown?.(result);
                        return (
                          <td key={result.id}>
                            {breakdown ? (
                              <BreakdownValue value={value} note={breakdown.note} tooltip={breakdown.tooltip} />
                            ) : (
                              value
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
