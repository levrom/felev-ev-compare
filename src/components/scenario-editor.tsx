import { Copy, Trash2 } from "lucide-react";
import { useMemo } from "react";
import type { UiText } from "../App";
import {
  InlineToggleField,
  MonthYearField,
  NumberField,
  SelectField,
  SummaryMetric,
  TextField,
  taxBreakdownTooltip,
} from "./fields";
import { eur, resolvePrivateUseRate, type ScenarioInput, type ScenarioResult } from "../lib/calculator";
import { mergeCredit, mergeLease } from "../lib/scenario";

export function ScenarioEditor({
  selected,
  selectedResult,
  onUpdateScenario,
  onDuplicateScenario,
  onDeleteScenario,
  ui,
}: {
  selected: ScenarioInput;
  selectedResult?: ScenarioResult;
  onUpdateScenario: (next: ScenarioInput) => void;
  onDuplicateScenario: () => void;
  onDeleteScenario: () => void;
  ui: UiText;
}) {
  const monthlyTaxSaving = selectedResult
    ? selectedResult.totalTaxSaving / Math.max(1, selectedResult.evaluationMonths)
    : 0;
  const monthlyBeforeTax = selectedResult
    ? selectedResult.totalNetCashOut / Math.max(1, selectedResult.evaluationMonths)
    : 0;
  const summaryTaxTooltip = useMemo(
    () =>
      selectedResult
        ? taxBreakdownTooltip({
            beforeTaxLabel: ui.summary.beforeTaxEquivalent,
            beforeTax: monthlyBeforeTax,
            taxSavingLabel: ui.summary.taxSavingMonthly,
            taxSaving: monthlyTaxSaving,
            afterTaxLabel: ui.summary.afterTaxEquivalent,
            afterTax: selectedResult.afterTaxMonthlyEquivalent,
            kstSaving: selectedResult.totalKstSaving / Math.max(1, selectedResult.evaluationMonths),
            soliSaving: selectedResult.totalSoliSaving / Math.max(1, selectedResult.evaluationMonths),
            gewstSaving: selectedResult.totalGewstSaving / Math.max(1, selectedResult.evaluationMonths),
          })
        : "",
    [monthlyBeforeTax, monthlyTaxSaving, selectedResult, ui],
  );

  return (
    <section className="editorShell">
      <div className="topbar">
        <div>
          <h2>{selected.car.name}</h2>
          <p>
            {scenarioTitle(selected, ui)} · {ui.actions.editSelected}
          </p>
        </div>
        <div className="actions">
          <button onClick={onDuplicateScenario}>
            <Copy size={16} /> {ui.actions.copy}
          </button>
          <button className="danger" onClick={onDeleteScenario}>
            <Trash2 size={16} /> {ui.actions.delete}
          </button>
        </div>
      </div>

      <section className="summaryStrip">
        <SummaryMetric
          label={ui.summary.afterTaxEquivalent}
          value={selectedResult ? eur(selectedResult.afterTaxMonthlyEquivalent) : "0 EUR"}
          note={selectedResult ? `(- ${eur(monthlyTaxSaving)} ${ui.summary.taxShort})` : undefined}
          tooltip={summaryTaxTooltip}
        />
        <SummaryMetric
          label={ui.summary.totalNetCash}
          value={selectedResult ? eur(selectedResult.totalNetCashOut) : "0 EUR"}
          tooltip={
            selectedResult
              ? [
                  `${ui.summary.totalNetCash}: ${eur(selectedResult.totalNetCashOut)}`,
                  `${ui.summary.afterTaxEquivalent}: ${eur(selectedResult.afterTaxMonthlyEquivalent)}`,
                  `${ui.summary.taxSaving}: ${eur(selectedResult.totalTaxSaving)}`,
                ].join("\n")
              : ""
          }
        />
        <SummaryMetric
          label={ui.summary.taxSaving}
          value={selectedResult ? eur(selectedResult.totalTaxSaving) : "0 EUR"}
          tooltip={summaryTaxTooltip}
        />
        <SummaryMetric
          label={ui.summary.benefitPa}
          value={selectedResult ? eur(selectedResult.privateUseBenefitAnnual) : "0 EUR"}
          tooltip={
            selectedResult
              ? [
                  `${ui.summary.benefitPa}: ${eur(selectedResult.privateUseBenefitAnnual)}`,
                  `${ui.summary.afterTaxEquivalent}: ${eur(selectedResult.afterTaxMonthlyEquivalent)}`,
                ].join("\n")
              : ""
          }
        />
      </section>

      <div className="workspace editorWorkspace">
        <section className="panel">
          <h3>{ui.sections.auto}</h3>
          <div className="formGrid">
            <TextField
              label={ui.fields.name}
              value={selected.car.name}
              onChange={(name) => onUpdateScenario({ ...selected, car: { ...selected.car, name } })}
              help={ui.help.name}
            />
            <SelectField
              label={ui.fields.condition}
              value={selected.car.condition}
              options={[
                { value: "new", label: ui.options.new },
                { value: "used", label: ui.options.used },
              ]}
              onChange={(condition) =>
                onUpdateScenario({ ...selected, car: { ...selected.car, condition } })
              }
              help={ui.help.condition}
            />
            <MonthYearField
              label={ui.fields.startMonth}
              monthValue={selected.car.startMonth}
              yearValue={selected.car.startYear}
              onMonthChange={(startMonth) =>
                onUpdateScenario({
                  ...selected,
                  car: { ...selected.car, startMonth: Math.max(1, Math.min(12, startMonth)) },
                })
              }
              onYearChange={(startYear) =>
                onUpdateScenario({
                  ...selected,
                  car: { ...selected.car, startYear },
                })
              }
              help={ui.help.startMonth}
            />
            <NumberField
              label={ui.fields.blpGross}
              value={selected.car.blpGross}
              onChange={(blpGross) =>
                onUpdateScenario({ ...selected, car: { ...selected.car, blpGross } })
              }
              suffix="EUR"
              help={ui.help.blpGross}
            />
            <NumberField
              label={ui.fields.purchasePriceGross}
              value={selected.car.purchasePriceGross}
              onChange={(purchasePriceGross) =>
                onUpdateScenario({
                  ...selected,
                  car: { ...selected.car, purchasePriceGross },
                })
              }
              suffix="EUR"
              help={ui.help.purchasePriceGross}
            />
            <MonthYearField
              label={ui.fields.firstRegistrationYear}
              monthValue={selected.car.firstRegistrationMonth ?? 1}
              yearValue={selected.car.firstRegistrationYear}
              onMonthChange={(firstRegistrationMonth) =>
                onUpdateScenario({
                  ...selected,
                  car: {
                    ...selected.car,
                    firstRegistrationMonth,
                  },
                })
              }
              onYearChange={(firstRegistrationYear) =>
                onUpdateScenario({
                  ...selected,
                  car: {
                    ...selected.car,
                    firstRegistrationYear,
                  },
                })
              }
              help={ui.help.firstRegistrationMonth}
            />
          </div>
        </section>

        <section className="panel">
          <h3>{ui.sections.financing}</h3>
          {selected.kind === "lease" && selected.lease ? (
            <div className="formGrid">
              <NumberField
                label={ui.fields.termMonths}
                value={selected.lease.termMonths}
                onChange={(termMonths) =>
                  onUpdateScenario({
                    ...selected,
                    lease: mergeLease(selected.lease!, { termMonths }),
                  })
                }
                suffix="Monate"
                help={ui.help.termMonths}
              />
              <NumberField
                label={ui.fields.monthlyRateGross}
                value={selected.lease.monthlyRateGross}
                onChange={(monthlyRateGross) =>
                  onUpdateScenario({
                    ...selected,
                    lease: mergeLease(selected.lease!, { monthlyRateGross }),
                  })
                }
                suffix="EUR"
                help={ui.help.monthlyRateGross}
              />
              <NumberField
                label={ui.fields.specialPaymentGross}
                value={selected.lease.specialPaymentGross}
                onChange={(specialPaymentGross) =>
                  onUpdateScenario({
                    ...selected,
                    lease: mergeLease(selected.lease!, { specialPaymentGross }),
                  })
                }
                suffix="EUR"
                help={ui.help.specialPaymentGross}
              />
              <NumberField
                label={ui.fields.feesGross}
                value={selected.lease.feesGross}
                onChange={(feesGross) =>
                  onUpdateScenario({
                    ...selected,
                    lease: mergeLease(selected.lease!, { feesGross }),
                  })
                }
                suffix="EUR"
                help={ui.help.feesGross}
              />
            </div>
          ) : selected.credit ? (
            <div className="formGrid">
              <NumberField
                label={ui.fields.termMonths}
                value={selected.credit.termMonths}
                onChange={(termMonths) =>
                  onUpdateScenario({
                    ...selected,
                    credit: mergeCredit(selected.credit!, { termMonths }),
                  })
                }
                suffix="Monate"
                help={ui.help.termMonths}
              />
              <NumberField
                label={ui.fields.downPaymentGross}
                value={selected.credit.downPaymentGross}
                onChange={(downPaymentGross) =>
                  onUpdateScenario({
                    ...selected,
                    credit: mergeCredit(selected.credit!, { downPaymentGross }),
                  })
                }
                suffix="EUR"
                help={ui.help.downPaymentGross}
              />
              <NumberField
                label={ui.fields.annualInterestRate}
                value={selected.credit.annualInterestRate * 100}
                step={0.1}
                onChange={(value) =>
                  onUpdateScenario({
                    ...selected,
                    credit: mergeCredit(selected.credit!, { annualInterestRate: value / 100 }),
                  })
                }
                suffix="% p.a."
                help={ui.help.annualInterestRate}
              />
              <NumberField
                label={ui.fields.balloonGross}
                value={selected.credit.balloonGross}
                onChange={(balloonGross) =>
                  onUpdateScenario({
                    ...selected,
                    credit: mergeCredit(selected.credit!, { balloonGross }),
                  })
                }
                suffix="EUR"
                help={ui.help.balloonGross}
              />
              <NumberField
                label={ui.fields.acquisitionCostsGross}
                value={selected.credit.acquisitionCostsGross}
                onChange={(acquisitionCostsGross) =>
                  onUpdateScenario({
                    ...selected,
                    credit: mergeCredit(selected.credit!, {
                      acquisitionCostsGross: Math.max(0, acquisitionCostsGross),
                    }),
                  })
                }
                suffix="EUR"
                help={ui.help.acquisitionCostsGross}
              />
              <NumberField
                label={ui.fields.feesGross}
                value={selected.credit.feesGross}
                onChange={(feesGross) =>
                  onUpdateScenario({ ...selected, credit: mergeCredit(selected.credit!, { feesGross }) })
                }
                suffix="EUR"
                help={ui.help.feesGross}
              />
              <NumberField
                label={ui.fields.salePriceNet}
                value={selected.car.salePriceNet}
                optionalToggle={{
                  checked: selected.car.salePriceNetEnabled,
                  onChange: (salePriceNetEnabled) =>
                    onUpdateScenario({
                      ...selected,
                      car: { ...selected.car, salePriceNetEnabled },
                    }),
                }}
                onChange={(salePriceNet) =>
                  onUpdateScenario({
                    ...selected,
                    car: { ...selected.car, salePriceNet: Math.max(0, salePriceNet) },
                  })
                }
                suffix="EUR"
                prepend={
                  <InlineToggleField<"gross" | "net">
                    value={selected.car.salePriceMode ?? "gross"}
                    options={[
                      { value: "gross", label: ui.priceModes.gross },
                      { value: "net", label: ui.priceModes.net },
                    ]}
                    onChange={(salePriceMode) =>
                      onUpdateScenario({
                        ...selected,
                        car: { ...selected.car, salePriceMode },
                      })
                    }
                    disabled={!selected.car.salePriceNetEnabled}
                  />
                }
                help={ui.help.salePriceNet}
              />
              <NumberField
                label={ui.fields.saleAfterMonths}
                value={selected.car.saleAfterMonths}
                optionalToggle={{
                  checked: selected.car.saleAfterMonthsEnabled,
                  onChange: (saleAfterMonthsEnabled) =>
                    onUpdateScenario({
                      ...selected,
                      car: { ...selected.car, saleAfterMonthsEnabled },
                    }),
                }}
                step={1}
                integer
                onChange={(saleAfterMonths) =>
                  onUpdateScenario({
                    ...selected,
                    car: {
                      ...selected.car,
                      saleAfterMonths: Math.max(0, saleAfterMonths),
                    },
                  })
                }
                suffix="Monate"
                help={ui.help.saleAfterMonths}
              />
            </div>
          ) : null}
        </section>

        <section className="panel">
          <h3>{ui.sections.usageCosts}</h3>
          <div className="formGrid">
            <SelectField
              label={ui.fields.privateUseMethod}
              value={selected.car.privateUseMethod ?? "auto-bev"}
              options={[
                { value: "auto-bev", label: ui.options.autoBev },
                { value: "fixed-rate", label: ui.options.fixedRate },
              ]}
              onChange={(privateUseMethod) =>
                onUpdateScenario({
                  ...selected,
                  car: { ...selected.car, privateUseMethod },
                })
              }
              help={ui.help.privateUseMethod}
            />
            <NumberField
              label={ui.fields.privateUseRate}
              value={
                (selected.car.privateUseMethod ?? "auto-bev") === "auto-bev"
                  ? resolvePrivateUseRate(selected.car) * 100
                  : selected.car.privateUseRate * 100
              }
              step={0.01}
              disabled={(selected.car.privateUseMethod ?? "auto-bev") === "auto-bev"}
              onChange={(value) =>
                onUpdateScenario({
                  ...selected,
                  car: { ...selected.car, privateUseRate: value / 100 },
                })
              }
              suffix="% / Monat"
              help={ui.help.privateUseRate}
            />
            <NumberField
              label={ui.fields.commuteDistanceKm}
              value={selected.car.commuteDistanceKm}
              optionalToggle={{
                checked: selected.car.commuteDistanceKmEnabled,
                onChange: (commuteDistanceKmEnabled) =>
                  onUpdateScenario({
                    ...selected,
                    car: { ...selected.car, commuteDistanceKmEnabled },
                  }),
              }}
              onChange={(commuteDistanceKm) =>
                onUpdateScenario({
                  ...selected,
                  car: { ...selected.car, commuteDistanceKm: Math.max(0, commuteDistanceKm) },
                })
              }
              suffix="km"
              help={ui.help.commuteDistanceKm}
            />
            <NumberField
              label={ui.fields.commuteMonthsPerYear}
              value={selected.car.commuteMonthsPerYear}
              optionalToggle={{
                checked: selected.car.commuteMonthsPerYearEnabled,
                onChange: (commuteMonthsPerYearEnabled) =>
                  onUpdateScenario({
                    ...selected,
                    car: { ...selected.car, commuteMonthsPerYearEnabled },
                  }),
              }}
              step={1}
              integer
              onChange={(commuteMonthsPerYear) =>
                onUpdateScenario({
                  ...selected,
                  car: {
                    ...selected.car,
                    commuteMonthsPerYear: Math.max(0, Math.min(12, commuteMonthsPerYear)),
                  },
                })
              }
              suffix="Monate"
              help={ui.help.commuteMonthsPerYear}
            />
            <NumberField
              label={ui.fields.commuteDaysPerMonth}
              value={selected.car.commuteDaysPerMonth}
              optionalToggle={{
                checked: selected.car.commuteDaysPerMonthEnabled,
                onChange: (commuteDaysPerMonthEnabled) =>
                  onUpdateScenario({
                    ...selected,
                    car: { ...selected.car, commuteDaysPerMonthEnabled },
                  }),
              }}
              step={1}
              integer
              onChange={(commuteDaysPerMonth) =>
                onUpdateScenario({
                  ...selected,
                  car: {
                    ...selected.car,
                    commuteDaysPerMonth: Math.max(0, Math.min(31, commuteDaysPerMonth)),
                  },
                })
              }
              suffix="Tage"
              help={ui.help.commuteDaysPerMonth}
            />
            <NumberField
              label={ui.fields.annualInsuranceGross}
              value={selected.car.annualInsuranceGross}
              optionalToggle={{
                checked: selected.car.annualInsuranceGrossEnabled,
                onChange: (annualInsuranceGrossEnabled) =>
                  onUpdateScenario({
                    ...selected,
                    car: { ...selected.car, annualInsuranceGrossEnabled },
                  }),
              }}
              onChange={(annualInsuranceGross) =>
                onUpdateScenario({
                  ...selected,
                  car: { ...selected.car, annualInsuranceGross: Math.max(0, annualInsuranceGross) },
                })
              }
              suffix="EUR"
              help={ui.help.annualInsuranceGross}
            />
            <NumberField
              label={ui.fields.annualChargingGross}
              value={selected.car.annualChargingGross}
              optionalToggle={{
                checked: selected.car.annualChargingGrossEnabled,
                onChange: (annualChargingGrossEnabled) =>
                  onUpdateScenario({
                    ...selected,
                    car: { ...selected.car, annualChargingGrossEnabled },
                  }),
              }}
              onChange={(annualChargingGross) =>
                onUpdateScenario({
                  ...selected,
                  car: { ...selected.car, annualChargingGross: Math.max(0, annualChargingGross) },
                })
              }
              suffix="EUR"
              help={ui.help.annualChargingGross}
            />
            <NumberField
              label={ui.fields.annualMaintenanceGross}
              value={selected.car.annualMaintenanceGross}
              optionalToggle={{
                checked: selected.car.annualMaintenanceGrossEnabled,
                onChange: (annualMaintenanceGrossEnabled) =>
                  onUpdateScenario({
                    ...selected,
                    car: { ...selected.car, annualMaintenanceGrossEnabled },
                  }),
              }}
              onChange={(annualMaintenanceGross) =>
                onUpdateScenario({
                  ...selected,
                  car: { ...selected.car, annualMaintenanceGross: Math.max(0, annualMaintenanceGross) },
                })
              }
              suffix="EUR"
              help={ui.help.annualMaintenanceGross}
            />
            <NumberField
              label={ui.fields.annualTiresGross}
              value={selected.car.annualTiresGross}
              optionalToggle={{
                checked: selected.car.annualTiresGrossEnabled,
                onChange: (annualTiresGrossEnabled) =>
                  onUpdateScenario({
                    ...selected,
                    car: { ...selected.car, annualTiresGrossEnabled },
                  }),
              }}
              onChange={(annualTiresGross) =>
                onUpdateScenario({
                  ...selected,
                  car: { ...selected.car, annualTiresGross: Math.max(0, annualTiresGross) },
                })
              }
              suffix="EUR"
              help={ui.help.annualTiresGross}
            />
          </div>
        </section>
      </div>
    </section>
  );
}

function scenarioTitle(scenario: ScenarioInput, ui: UiText) {
  return scenario.kind === "lease"
    ? ui.scenarioSummaries.lease
    : scenario.kind === "credit-new"
      ? ui.scenarioSummaries.creditNew
      : ui.scenarioSummaries.creditUsed;
}
