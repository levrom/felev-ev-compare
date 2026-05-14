import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  BarChart3,
  Download,
  Plus,
  Upload,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  DEFAULT_TAX_SETTINGS,
  calculateScenario,
  eur,
  type SalePriceMode,
  type CarInput,
  type CreditInput,
  type LeaseInput,
  type ScenarioInput,
  type ScenarioKind,
  type TaxSettings,
  type VatMode,
} from "./lib/calculator";
import { DEFAULT_SCENARIOS } from "./lib/defaults";
import { CompareModal as CompareModalView } from "./components/compare-modal";
import type { ScenarioResult } from "./components/compare-modal";
import { currentDateStamp, formatMonthKey, normalizeMonthKey } from "./lib/dates";
import { scenarioTitle } from "./lib/scenario";
import {
  BreakdownValue,
  InlineToggleField,
  MonthField,
  MonthYearField,
  NumberField,
  SelectField,
  SummaryMetric,
  TextField,
  ToggleField,
  TooltipButton,
  formatTaxNote,
  taxBreakdownTooltip,
} from "./components/fields";
import { ScenarioEditor as ScenarioEditorView } from "./components/scenario-editor";
type LanguageCode = "de" | "en" | "ru";

type AppState = {
  scenarios: ScenarioInput[];
  selectedId: string;
  settings: TaxSettings;
  language: LanguageCode;
};

export type UiText = Widen<(typeof UI_TEXT)["de"]>;

type PrivateUseMode = "auto-bev" | "fixed-rate";
type LegacyScenarioInput = Omit<ScenarioInput, "lease" | "credit"> & {
  lease?: LeaseInput & { otherAnnualGewstAddbacks?: number };
  credit?: CreditInput & { otherAnnualGewstAddbacks?: number };
};

type AppStateExportPayload = {
  app: "gmbh-ev-compare";
  version: 1;
  exportedAt: string;
  state: AppState;
};

const UI_TEXT = {
  de: {
    appName: "GmbH EV Vergleich",
    language: "Sprache",
    languages: {
      de: "DE",
      en: "EN",
      ru: "RU",
    },
    sidebar: {
      taxSettings: "Steuern",
      compare: "Vergleichen",
      exportJson: "JSON exportieren",
      importJson: "JSON importieren",
      addLease: "Leasing",
      addCreditNew: "Kredit neu",
      addCreditUsed: "Kredit gebraucht",
      impressum: "Impressum",
      privacy: "Datenschutzerklärung",
    },
    scenarioKinds: {
      lease: "Gewerbeleasing",
      creditNew: "Ballonkredit neu",
      creditUsed: "Ballonkredit gebraucht",
    },
    scenarioSummaries: {
      lease: "Leasing",
      creditNew: "Kredit neu",
      creditUsed: "Kredit gebraucht",
    },
    actions: {
      copy: "Kopieren",
      delete: "Entfernen",
      editSelected: "ausgewähltes Szenario bearbeiten",
    },
    summary: {
      beforeTaxEquivalent: "Vor Steuern / Monat",
      afterTaxEquivalent: "Nach Steuern / Monat",
      totalNetCash: "Netto-Cashflow",
      taxSaving: "Steuerersparnis",
      taxSavingMonthly: "Steuerersparnis / Monat",
      taxShort: "Steuer",
      benefitPa: "Privatnutzung p.a.",
      perMonth: "/Monat",
    },
    sections: {
      auto: "Auto",
      financing: "Finanzierung",
      usageCosts: "Nutzung & laufende Kosten",
      taxSettings: "Steuereinstellungen",
      compare: "Vergleich",
      byYear: "Nach Jahren",
      byMonth: "Nach Monaten",
      moreInputs: "Weitere Angaben für genauere Berechnungen",
    },
    fields: {
      name: "Name",
      condition: "Zustand",
      startMonth: "Beginn der Nutzung",
      blpGross: "Bruttolistenpreis",
      purchasePriceGross: "Kaufpreis brutto",
      vatRate: "USt-Satz",
      usedVatMode: "USt bei Gebrauchtwagen",
      firstRegistrationMonth: "Erstzulassung Monat",
      firstRegistrationYear: "Erstzulassung",
      afaYears: "AfA-Jahre",
      privateUseMethod: "Methode Privatnutzung",
      privateUseRate: "Privatnutzungssatz",
      commuteDistanceKm: "Arbeitsweg einfach",
      commuteMonthsPerYear: "Arbeitsweg Monate p.a.",
      commuteDaysPerMonth: "Arbeitsweg Tage p. M.",
      annualInsuranceGross: "Versicherung p.a.",
      annualChargingGross: "Laden p.a. brutto",
      annualMaintenanceGross: "Wartung p.a. brutto",
      annualTiresGross: "Reifen p.a. brutto",
      salePriceNet: "Verkaufspreis",
      salePriceMode: "Preisart",
      saleAfterMonths: "Verkauf nach Monaten",
      termMonths: "Laufzeit",
      offeredMonthlyPaymentGross: "Rate laut Angebot",
      monthlyPaymentGross: "Berechnete Monatsrate",
      monthlyRateGross: "Rate brutto",
      specialPaymentGross: "Sonderzahlung brutto",
      feesGross: "Gebühren brutto",
      otherGewstAddbacks: "Sonstige GewSt-Hinzurechnungen p.a.",
      downPaymentGross: "Anzahlung brutto",
      annualInterestRate: "Sollzinssatz",
      balloonGross: "Schlussrate/Ballon",
      acquisitionCostsGross: "Kaufnebenkosten brutto",
      profitBeforeCar: "Gewinn vor Auto",
      calculationStartMonth: "Berechnungsstart",
      gewstHebesatz: "GewSt-Hebesatz",
      kst: "KSt",
      soliOnKSt: "Soli auf KSt",
    },
    compareModes: {
      year: "Jahre",
      month: "Monate",
    },
    messages: {
      invalidImport: "Ungültige JSON-Datei.",
    },
    priceModes: {
      gross: "Brutto",
      net: "Netto",
    },
    options: {
      new: "Neu",
      used: "Gebraucht",
      regularVat: "Reguläre USt-Rechnung",
      noVat: "Keine abziehbare USt / Differenzbesteuerung",
      autoBev: "Automatische BEV-Regel",
      fixedRate: "Fester Satz",
    },
    compareRows: {
      year: "Jahr",
      month: "Monat",
      yearAfterTax: "Effektiv nach Steuern",
      yearTaxSaving: "Steuerersparnis",
      afterTaxMonth: "Nach Steuern / Monat",
      leasingFactor: "Leasingfaktor",
      averageMonthlyGross: "Ø Vertragskosten / Monat",
      totalGross: "Summe brutto",
      vorsteuer: "Vorsteuer",
      netCash: "Netto-Cashflow",
      deductible: "Abziehbare Kosten",
      gewstAddback: "GewSt-Hinzurechnung",
      gewstAddbackRate: "GewSt-Hinzurechnungsquote",
      taxSaving: "Steuerersparnis",
      benefitPa: "Privatnutzung p.a.",
      best: "Niedrigste Gesamtkosten",
    },
    modals: {
      compareDescription: "Vergleich nach Jahren und Summen je Szenario.",
      closeTaxSettings: "Steuereinstellungen schließen",
      closeCompare: "Vergleich schließen",
      closeScenario: "Szenario schließen",
      noScenarioSelected: "Kein Szenario ausgewählt.",
      titleCompare: "Vergleich",
    },
    suggestions: [
      {
        title: "Rechnungsaufteilung",
        text: "Nettopreis, USt, Überführung, Zulassung, Reifen, Wallbox und weitere Rechnungspositionen.",
      },
      {
        title: "Termine",
        text: "Bestellmonat, Liefermonat, erste Zahlung und Anzahlung für die zeitliche Zuordnung je Jahr.",
      },
      {
        title: "Haltedauer",
        text: "Geplanter Verkauf, Restwert oder Anschlussfinanzierung für eine vollständige Betrachtung.",
      },
      {
        title: "Privatnutzung",
        text: "Private Jahresfahrleistung, Arbeitsweg und ob 0,25%-Regel oder Fahrtenbuch gilt.",
      },
      {
        title: "Fahrzeugkosten",
        text: "Versicherung, Laden, Wartung, Winterreifen und Haushaltsstrom, sofern sie einbezogen werden sollen.",
      },
      {
        title: "Angaben zum Gebrauchtwagen",
        text: "Laufleistung, Batteriezustand, Garantie, Erstzulassung und verbleibende Nutzungsdauer für die AfA.",
      },
    ],
    help: {
      profitBeforeCar: "Jährlicher Gewinn vor Fahrzeugkosten. Er ist die Ausgangsbasis für KSt, Soli und GewSt.",
      gewstHebesatz: "Berliner Standardwert ist 410. Er skaliert die GewSt-Berechnung und damit die Steuerwirkung.",
      kst: "Körperschaftsteuersatz für die Ersparnis auf abziehbare Fahrzeugkosten.",
      soliOnKSt: "Solidaritätszuschlag auf die berechnete KSt-Ersparnis.",
      name: "Anzeigename des Szenarios. Keine Auswirkung auf die Rechnung.",
      condition: "Bestimmt, ob AfA und USt nach Neu- oder Gebrauchtwagenregeln laufen.",
      startMonth: "Monat und Jahr des Nutzungsbeginns. AfA, laufende Kosten und Monatsvergleich richten sich an diesem Startdatum aus.",
      blpGross: "Bruttolistenpreis für den geldwerten Vorteil. Er steuert auch die automatische 0,25%/0,5%-Regel.",
      purchasePriceGross: "Gesamter Kaufpreis brutto vor Finanzierung. Daraus kommen Cashflow und Vorsteuerlogik.",
      vatRate: "Globaler USt-Satz für Brutto-Netto-Aufteilung und Vorsteuerabzug.",
      usedVatMode: "Steuerlogik für Gebrauchtwagen, wenn keine abziehbare USt vorliegt.",
      firstRegistrationMonth: "Monat der Erstzulassung. Er gehört mit dem Jahr zur Datumsbasis für Monatsansichten und das Gebrauchtwagenalter.",
      firstRegistrationYear: "Dient zur Ableitung des Fahrzeugalters für Gebrauchtwagen.",
      afaYears: "Globaler AfA-Zeitraum, der die Abschreibungsdauer bestimmt.",
      privateUseMethod: "Wählt zwischen BEV-Regel und manuellem Satz. Das beeinflusst nur den geldwerten Vorteil.",
      privateUseRate: "Monatlicher Privatnutzungssatz. Er geht in die private-use-Zeile ein, nicht in die Betriebskosten.",
      commuteDistanceKm: "Einfache Entfernung zur ersten Tätigkeitsstätte. Sie erhöht den geldwerten Vorteil.",
      commuteMonthsPerYear: "Anzahl der Monate pro Jahr für den Arbeitsweg. Mehr Monate erhöhen den privaten Nutzungswert.",
      commuteDaysPerMonth:
        "Monatliche Arbeitstage für die 0,002%-Methode. Unter 15 Tagen pro Monat schaltet das Tool auf die Tagesmethode um.",
      annualInsuranceGross: "Betriebsausgabe im Cashflow. Bei Versicherung wird hier typischerweise keine Vorsteuer gezogen.",
      annualChargingGross: "Betriebsausgabe im Cashflow. Bei USt-Rechnung wird die Vorsteuer separat abgezogen.",
      annualMaintenanceGross: "Betriebsausgabe im Cashflow. Bei USt-Rechnung wird die Vorsteuer separat abgezogen.",
      annualTiresGross: "Betriebsausgabe im Cashflow. Bei USt-Rechnung wird die Vorsteuer separat abgezogen.",
      salePriceNet:
        "Verkaufserlös am Ende der Nutzung. Die Preisart entscheidet, ob der Betrag als brutto oder netto interpretiert wird.",
      salePriceMode:
        "Wählt, ob der eingegebene Betrag als Brutto- oder Netto-Verkaufspreis gelesen wird.",
      saleAfterMonths:
        "Monat des Verkaufs relativ zum Start. Standard ist das Kreditende; früherer Verkauf wird für die TCO berücksichtigt, wenn er über die Monatszahl aktiviert ist.",
      termMonths: "Laufzeit in Monaten. Sie steuert die zeitliche Verteilung von Zahlungen und Abzügen.",
      offeredMonthlyPaymentGross:
        "Monatliche Rate aus dem Finanzierungsangebot. Vergleiche sie mit der berechneten Rate darunter.",
      monthlyPaymentGross: "Aus Laufzeit, Anzahlung, Zins und Ballon berechnete Monatsrate. Nur informativ.",
      monthlyRateGross: "Monatliche Leasingrate brutto. Sie fließt in Cashflow, Vorsteuer und den GewSt-Hinzurechnungsanteil ein.",
      specialPaymentGross: "Einmalige Zahlung zu Beginn. Sie erhöht Cashflow und Vorsteuer im ersten Jahr.",
      feesGross: "Zusätzliche Gebühren oder Nebenkosten. Sie erhöhen den Cashflow und können Vorsteuer auslösen.",
      otherGewstAddbacks: "Weitere jährliche GewSt-Hinzurechnungen außerhalb des Fahrzeugs. Sie erhöhen den GewSt-Add-back nach Freibetrag.",
      downPaymentGross: "Sofort gezahlte Anzahlung. Sie reduziert den finanzierten Betrag, ist aber nicht als Aufwand abziehbar.",
      annualInterestRate: "Nominaler Zinssatz des Ballonkredits. Er bestimmt den Zinsanteil und damit die abziehbaren Kosten.",
      balloonGross: "Schlussrate am Laufzeitende. Sie ist Cashflow, aber kein direkter Aufwand.",
      acquisitionCostsGross: "Kaufnebenkosten erhöhen die AfA-Basis; abziehbare USt wird separat als Vorsteuer behandelt.",
      calculationStartMonth:
        "Legt Monat 1 in der Monatsansicht fest. Ändert die Steuerformeln nicht, nur die Datumslabels.",
    },
    hints: {
      invoiceSplit:
        "Nettopreis, USt, Überführung, Zulassung, Reifen, Wallbox und weitere Rechnungspositionen.",
      dates:
        "Bestellmonat, Liefermonat, erste Zahlung und Anzahlung für die zeitliche Zuordnung je Jahr.",
      holdingPeriod:
        "Geplanter Verkauf, Restwert oder Anschlussfinanzierung für eine vollständige Betrachtung.",
      privateUse:
        "Private Jahresfahrleistung, Arbeitsweg und ob 0,25%-Regel oder Fahrtenbuch gilt.",
      vehicleCosts:
        "Versicherung, Laden, Wartung, Winterreifen und Haushaltsstrom, sofern sie einbezogen werden sollen.",
      usedCarDetails:
        "Laufleistung, Batteriezustand, Garantie, Erstzulassung und verbleibende Nutzungsdauer für die AfA.",
    },
    appHintIntro:
      "Ergänze diese Angaben, sobald sie vorliegen. Dadurch wird die Berechnung genauer:",
  },
  en: {
    appName: "GmbH EV Comparison",
    language: "Language",
    languages: {
      de: "DE",
      en: "EN",
      ru: "RU",
    },
    sidebar: {
      taxSettings: "Tax Settings",
      compare: "Compare",
      exportJson: "Export JSON",
      importJson: "Import JSON",
      addLease: "Lease",
      addCreditNew: "New loan",
      addCreditUsed: "Used loan",
      impressum: "Imprint",
      privacy: "Privacy",
    },
    scenarioKinds: {
      lease: "Business lease",
      creditNew: "Balloon loan new",
      creditUsed: "Balloon loan used",
    },
    scenarioSummaries: {
      lease: "Lease",
      creditNew: "Credit new",
      creditUsed: "Credit used",
    },
    actions: {
      copy: "Copy",
      delete: "Delete",
      editSelected: "edit selected scenario",
    },
    summary: {
      beforeTaxEquivalent: "Before tax / month",
      afterTaxEquivalent: "After-tax equivalent",
      totalNetCash: "Total net cash",
      taxSaving: "Tax saving",
      taxSavingMonthly: "Tax saving / month",
      taxShort: "tax",
      benefitPa: "Benefit p.a.",
      perMonth: "/mo",
    },
    sections: {
      auto: "Vehicle",
      financing: "Financing",
      usageCosts: "Use & running costs",
      taxSettings: "Tax Settings",
      compare: "Compare",
      byYear: "By Year",
      byMonth: "By Month",
      moreInputs: "More inputs to improve accuracy",
    },
    fields: {
      name: "Name",
      condition: "Condition",
      startMonth: "Usage start",
      blpGross: "List price",
      purchasePriceGross: "Purchase price gross",
      vatRate: "VAT rate",
      usedVatMode: "Used VAT mode",
      firstRegistrationMonth: "First registration month",
      firstRegistrationYear: "First registration",
      afaYears: "Afa years",
      privateUseMethod: "Private-use method",
      privateUseRate: "Private-use rate",
      commuteDistanceKm: "Commute one-way",
      commuteMonthsPerYear: "Commute months p.a.",
      commuteDaysPerMonth: "Commute days/mo",
      annualInsuranceGross: "Insurance p.a.",
      annualChargingGross: "Charging p.a. gross",
      annualMaintenanceGross: "Maintenance p.a. gross",
      annualTiresGross: "Tires p.a. gross",
      salePriceNet: "Sale price",
      salePriceMode: "Price mode",
      saleAfterMonths: "Sale after months",
      termMonths: "Term",
      offeredMonthlyPaymentGross: "Quoted monthly payment",
      monthlyPaymentGross: "Calculated monthly payment",
      monthlyRateGross: "Gross payment",
      specialPaymentGross: "Upfront payment",
      feesGross: "Fees gross",
      otherGewstAddbacks: "Other GewSt add-backs p.a.",
      downPaymentGross: "Down payment gross",
      annualInterestRate: "Interest rate",
      balloonGross: "Balloon payment",
      acquisitionCostsGross: "Acquisition costs gross",
      profitBeforeCar: "Profit before car",
      calculationStartMonth: "Comparison start",
      gewstHebesatz: "GewSt rate",
      kst: "CIT",
      soliOnKSt: "Soli on CIT",
    },
    compareModes: {
      year: "Years",
      month: "Months",
    },
    messages: {
      invalidImport: "Invalid JSON file.",
    },
    priceModes: {
      gross: "Gross",
      net: "Net",
    },
    options: {
      new: "New",
      used: "Used",
      regularVat: "Regular VAT invoice",
      noVat: "No deductible VAT / margin",
      autoBev: "Auto BEV rule",
      fixedRate: "Fixed rate",
    },
    compareRows: {
      year: "Year",
      month: "Month",
      yearAfterTax: "After-tax effective",
      yearTaxSaving: "Tax saving",
      afterTaxMonth: "After-tax / month",
      leasingFactor: "Leasing factor",
      averageMonthlyGross: "Avg. contract cost / month",
      totalGross: "Total gross",
      vorsteuer: "Input VAT",
      netCash: "Net cash",
      deductible: "Deductible",
      gewstAddback: "GewSt add-back",
      gewstAddbackRate: "GewSt add-back rate",
      taxSaving: "Tax saving",
      benefitPa: "Benefit p.a.",
      best: "Lowest total cost",
    },
    modals: {
      compareDescription: "Yearly comparison and scenario totals.",
      closeTaxSettings: "Close tax settings",
      closeCompare: "Close compare",
      closeScenario: "Close scenario",
      noScenarioSelected: "No scenario selected.",
      titleCompare: "Compare",
    },
    suggestions: [
      {
        title: "Invoice split",
        text: "Net price, VAT, delivery, registration, tires, wallbox, and any other invoice line items.",
      },
      {
        title: "Dates",
        text: "Order month, delivery month, first payment date, and down payment date for year-by-year timing.",
      },
      {
        title: "Holding period",
        text: "Expected sale date, resale value, or balloon replacement plan for a full ownership view.",
      },
      {
        title: "Private use",
        text: "Annual private mileage, commute distance, and whether 0.25% or a logbook method applies.",
      },
      {
        title: "Vehicle costs",
        text: "Insurance, charging, maintenance, winter tires, and home electricity if they should be included.",
      },
      {
        title: "Used-car details",
        text: "Mileage, battery state, warranty, first registration, and remaining useful life for AfA.",
      },
    ],
    help: {
      profitBeforeCar: "Annual profit before car costs. This is the tax base for CIT, Soli, and GewSt.",
      gewstHebesatz: "Berlin default is 410. It scales the GewSt calculation and the resulting tax effect.",
      kst: "Corporate income tax rate used to value deductible vehicle costs.",
      soliOnKSt: "Solidarity surcharge applied to the calculated CIT saving.",
      name: "Scenario label. It does not change the calculation.",
      condition: "Decides whether AfA and VAT use the new-car or used-car rule set.",
      startMonth: "Month and year when the vehicle starts being used. AfA, running costs, and monthly compare labels are anchored to this start date.",
      blpGross: "Gross list price for the benefit-in-kind calculation. It also drives the auto 0.25% / 0.5% rule.",
      purchasePriceGross: "Total gross purchase price before financing. It feeds cash out and VAT split logic.",
      vatRate: "Global VAT rate used for gross/net split and input VAT recovery.",
      usedVatMode: "Tax mode for used cars when no deductible VAT is available.",
      firstRegistrationMonth: "Month of first registration. Paired with the year for monthly compare labels and used-car age.",
      firstRegistrationYear: "Used-car age comes from this year.",
      afaYears: "Global depreciation horizon used for AfA.",
      privateUseMethod: "Chooses between the BEV rule and a manual rate. It only affects the private-use benefit.",
      privateUseRate: "Monthly private-use percentage. It enters the benefit row, not company expenses.",
      commuteDistanceKm: "One-way commute distance. It increases the private-use benefit amount.",
      commuteMonthsPerYear: "Number of months per year for the commute benefit. More months increase the benefit.",
      commuteDaysPerMonth:
        "Average commute days per month. Below 15 days the calculator uses the 0.002% daily commute rule.",
      annualInsuranceGross: "Operating expense in cash flow. Insurance usually has no deductible VAT.",
      annualChargingGross: "Operating expense in cash flow. Deductible VAT is recovered when invoiced with VAT.",
      annualMaintenanceGross: "Operating expense in cash flow. Deductible VAT is recovered when invoiced with VAT.",
      annualTiresGross: "Operating expense in cash flow. Deductible VAT is recovered when invoiced with VAT.",
      salePriceNet:
        "Sale proceeds at the end of use. The price mode decides whether the entered amount is treated as gross or net.",
      salePriceMode:
        "Chooses whether the entered amount is interpreted as a gross or net sale price.",
      saleAfterMonths:
        "Month of sale relative to the start date. The default is the loan end; if enabled, the calculator uses this month for TCO and the final-year gain.",
      termMonths: "Term in months. It drives the timing of payments and deductions.",
      offeredMonthlyPaymentGross:
        "Monthly payment from the financing quote. Compare it with the calculated rate below.",
      monthlyPaymentGross: "Calculated from term, down payment, interest, and balloon. Informational only.",
      monthlyRateGross: "Monthly leasing payment gross. It affects cash out, VAT, and the GewSt add-back base.",
      specialPaymentGross: "One-time upfront payment. It increases first-year cash out and VAT recovery.",
      feesGross: "Additional fees or delivery charges. They increase cash out and may generate VAT recovery.",
      otherGewstAddbacks: "Other annual GewSt add-backs outside this vehicle. They increase the add-back above the allowance.",
      downPaymentGross: "Upfront payment not financed. It reduces loan principal but is not deductible as expense.",
      annualInterestRate: "Nominal annual interest rate. It determines the interest share and deductible finance cost.",
      balloonGross: "Final balloon or residual payment at the end of the term. It is cash out, not a direct expense.",
      acquisitionCostsGross: "Acquisition costs increase the AfA base; deductible VAT is treated separately as input VAT.",
      calculationStartMonth:
        "Sets month 1 in the monthly compare view. It changes labels only, not the formulas.",
    },
    hints: {
      invoiceSplit:
        "Net price, VAT, delivery, registration, tires, wallbox, and any other invoice line items.",
      dates:
        "Order month, delivery month, first payment date, and down payment date for year-by-year timing.",
      holdingPeriod:
        "Expected sale date, resale value, or balloon replacement plan for a full ownership view.",
      privateUse:
        "Annual private mileage, commute distance, and whether 0.25% or a logbook method applies.",
      vehicleCosts:
        "Insurance, charging, maintenance, winter tires, and home electricity if they should be included.",
      usedCarDetails:
        "Mileage, battery state, warranty, first registration, and remaining useful life for AfA.",
    },
    appHintIntro:
      "Add more data when you have it. The calculator becomes more precise with these inputs:",
  },
  ru: {
    appName: "Сравнение GmbH EV",
    language: "Язык",
    languages: {
      de: "DE",
      en: "EN",
      ru: "RU",
    },
    sidebar: {
      taxSettings: "Налоговые настройки",
      compare: "Сравнение",
      exportJson: "Экспорт JSON",
      importJson: "Импорт JSON",
      addLease: "Лизинг",
      addCreditNew: "Кредит новый",
      addCreditUsed: "Кредит б/у",
      impressum: "Импрессум",
      privacy: "Политика",
    },
    scenarioKinds: {
      lease: "Коммерческий лизинг",
      creditNew: "Баллонный кредит новый",
      creditUsed: "Баллонный кредит б/у",
    },
    scenarioSummaries: {
      lease: "Лизинг",
      creditNew: "Кредит новый",
      creditUsed: "Кредит б/у",
    },
    actions: {
      copy: "Копировать",
      delete: "Удалить",
      editSelected: "редактировать сценарий",
    },
    summary: {
      beforeTaxEquivalent: "До налога / мес",
      afterTaxEquivalent: "После налога / мес",
      totalNetCash: "Итого net cash",
      taxSaving: "Экономия налога",
      taxSavingMonthly: "Экономия налога / мес",
      taxShort: "налог",
      benefitPa: "Выгода в год",
      perMonth: "/мес",
    },
    sections: {
      auto: "Авто",
      financing: "Финансирование",
      usageCosts: "Использование и расходы",
      taxSettings: "Налоговые настройки",
      compare: "Сравнение",
      byYear: "По годам",
      byMonth: "По месяцам",
      moreInputs: "Какие данные ещё помогут уточнить расчёт",
    },
    fields: {
      name: "Название",
      condition: "Состояние",
      startMonth: "Beginn der Nutzung",
      blpGross: "Каталожная цена",
      purchasePriceGross: "Цена покупки gross",
      vatRate: "Ставка НДС",
      usedVatMode: "НДС для б/у",
      firstRegistrationMonth: "Месяц первой регистрации",
      firstRegistrationYear: "Первая регистрация",
      afaYears: "Годы AfA",
      privateUseMethod: "Метод личного использования",
      privateUseRate: "Личный процент",
      commuteDistanceKm: "Путь до работы в одну сторону",
      commuteMonthsPerYear: "Месяцы commute в год",
      commuteDaysPerMonth: "Дни commute/мес",
      annualInsuranceGross: "Страховка в год",
      annualChargingGross: "Зарядка в год gross",
      annualMaintenanceGross: "Сервис в год gross",
      annualTiresGross: "Шины в год gross",
      salePriceNet: "Цена продажи",
      salePriceMode: "Режим цены",
      saleAfterMonths: "Продажа через мес.",
      termMonths: "Срок",
      offeredMonthlyPaymentGross: "Платёж по офферу",
      monthlyPaymentGross: "Рассчитанный платёж",
      monthlyRateGross: "Платёж gross",
      specialPaymentGross: "Первый платёж",
      feesGross: "Комиссии gross",
      otherGewstAddbacks: "Прочие доплаты GewSt в год",
      downPaymentGross: "Аванс gross",
      annualInterestRate: "Процент",
      balloonGross: "Баллонный платёж",
      acquisitionCostsGross: "Расходы покупки gross",
      profitBeforeCar: "Прибыль до авто",
      calculationStartMonth: "Старт сравнения",
      gewstHebesatz: "Коэффициент GewSt",
      kst: "KSt",
      soliOnKSt: "Soli на KSt",
    },
    compareModes: {
      year: "Годы",
      month: "Месяцы",
    },
    messages: {
      invalidImport: "Некорректный JSON-файл.",
    },
    priceModes: {
      gross: "Брутто",
      net: "Нетто",
    },
    options: {
      new: "Новое",
      used: "Б/у",
      regularVat: "Обычный счёт с НДС",
      noVat: "НДС не вычитается / margin",
      autoBev: "Авто BEV",
      fixedRate: "Фиксированная ставка",
    },
    compareRows: {
      year: "Год",
      month: "Месяц",
      yearAfterTax: "Эффективно после налога",
      yearTaxSaving: "Экономия налога",
      afterTaxMonth: "После налога / мес",
      leasingFactor: "Лизинговый фактор",
      averageMonthlyGross: "Средняя стоимость / мес.",
      totalGross: "Итого gross",
      vorsteuer: "Входной НДС",
      netCash: "Net cash",
      deductible: "Вычитается",
      gewstAddback: "Доплата GewSt",
      gewstAddbackRate: "Доля доплаты GewSt",
      taxSaving: "Экономия налога",
      benefitPa: "Выгода в год",
      best: "Минимальная итоговая стоимость",
    },
    modals: {
      compareDescription: "Сравнение по годам и итоговые значения по сценариям.",
      closeTaxSettings: "Закрыть настройки",
      closeCompare: "Закрыть сравнение",
      closeScenario: "Закрыть сценарий",
      noScenarioSelected: "Сценарий не выбран.",
      titleCompare: "Сравнение",
    },
    suggestions: [
      {
        title: "Разбивка счёта",
        text: "Net price, VAT, delivery, registration, tires, wallbox and other line items.",
      },
      {
        title: "Даты",
        text: "Order, delivery, first payment and down payment dates help with annual timing.",
      },
      {
        title: "Срок владения",
        text: "Planned sale date, resale value or balloon replacement plan improve the total view.",
      },
      {
        title: "Личное использование",
        text: "Annual private mileage, commute distance and whether 0.25% or logbook applies.",
      },
      {
        title: "Затраты на авто",
        text: "Insurance, charging, maintenance, winter tires and home electricity if included.",
      },
      {
        title: "Данные б/у авто",
        text: "Mileage, battery state, warranty, first registration and remaining useful life.",
      },
    ],
    help: {
      profitBeforeCar: "Годовая прибыль до авто. Это база для KSt, Soli и GewSt.",
      gewstHebesatz: "Для Берлина по умолчанию 410. Он масштабирует расчет GewSt и налоговый эффект.",
      kst: "Ставка налога на прибыль для оценки экономии от вычитаемых расходов.",
      soliOnKSt: "Soli, который начисляется на рассчитанную экономию KSt.",
      name: "Название сценария. На расчет не влияет.",
      condition: "Определяет, применять правила AfA и НДС для нового или б/у авто.",
      startMonth: "Месяц и год начала использования. AfA, годовые расходы и месячное сравнение привязаны к этой дате.",
      blpGross: "Каталожная цена для льготы в натуре. Она же задает авто-правило 0.25% / 0.5%.",
      purchasePriceGross: "Итоговая цена покупки до финансирования. От нее считаются cash out и НДС.",
      vatRate: "Глобальная ставка НДС для разложения gross/net и Vorsteuer.",
      usedVatMode: "Налоговый режим для б/у авто, если входной НДС не вычитается.",
      firstRegistrationMonth: "Месяц первой регистрации. Вместе с годом он задаёт дату для месячной таблицы и возраста авто.",
      firstRegistrationYear: "Из этого года считается возраст авто.",
      afaYears: "Глобальный срок AfA для амортизации покупки.",
      privateUseMethod: "Выбирает между правилом BEV и ручным процентом. Влияет только на private-use benefit.",
      privateUseRate: "Ежемесячный процент личного использования. Он идет в строку выгоды, а не в расходы компании.",
      commuteDistanceKm: "Расстояние до работы в одну сторону. Оно увеличивает geldwerter Vorteil.",
      commuteMonthsPerYear: "Сколько месяцев в год учитывать commute benefit. Больше месяцев — выше выгода.",
      commuteDaysPerMonth:
        "Среднее число дней commute в месяц. Ниже 15 дней калькулятор переключается на дневное правило 0,002%.",
      annualInsuranceGross: "Betriebsausgabe в cash flow. У страховки обычно нет входного НДС.",
      annualChargingGross: "Betriebsausgabe в cash flow. При счете с НДС Vorsteuer вычитается отдельно.",
      annualMaintenanceGross: "Betriebsausgabe в cash flow. При счете с НДС Vorsteuer вычитается отдельно.",
      annualTiresGross: "Betriebsausgabe в cash flow. При счете с НДС Vorsteuer вычитается отдельно.",
      salePriceNet:
        "Сумма продажи в конце использования. Режим цены определяет, интерпретируется ли введённое значение как gross или net.",
      salePriceMode:
        "Выбирает, считать введённую сумму валовой или чистой ценой продажи.",
      saleAfterMonths:
        "Месяц продажи от начала сценария. По умолчанию это конец кредита; если включить поле, он участвует в TCO и в прибыли финального года.",
      termMonths: "Срок договора в месяцах. Он определяет распределение платежей и вычетов.",
      offeredMonthlyPaymentGross:
        "Ежемесячный платёж из оффера. Сравни его с рассчитанным платежом ниже.",
      monthlyPaymentGross: "Рассчитывается из срока, аванса, процента и баллона. Только для справки.",
      monthlyRateGross: "Ежемесячный лизинговый платеж gross. Он влияет на cash flow, НДС и add-back по GewSt.",
      specialPaymentGross: "Разовый платеж в начале договора. Он увеличивает первый год cash out и Vorsteuer.",
      feesGross: "Дополнительные комиссии или расходы. Они увеличивают cash out и могут дать Vorsteuer.",
      otherGewstAddbacks: "Другие годовые доплаты GewSt вне этого авто. Они увеличивают add-back сверх льготы.",
      downPaymentGross: "Аванс, который платится сразу. Он уменьшает финансируемую сумму, но не является расходом.",
      annualInterestRate: "Номинальная годовая ставка. Она определяет долю процентов и вычитаемых расходов.",
      balloonGross: "Последний платеж в конце срока. Это cash out, но не прямой расход.",
      acquisitionCostsGross: "Расходы покупки увеличивают базу AfA; выделенный НДС учитывается отдельно как Vorsteuer.",
      calculationStartMonth:
        "Задаёт месяц 1 в месячном сравнении. Формулы не меняет, только подписи дат.",
    },
    hints: {
      invoiceSplit:
        "Net price, VAT, delivery, registration, tires, wallbox and other invoice line items.",
      dates:
        "Order, delivery, first payment and down payment dates help with annual timing.",
      holdingPeriod:
        "Planned sale date, resale value or balloon replacement plan improve the total view.",
      privateUse:
        "Annual private mileage, commute distance and whether 0.25% or logbook applies.",
      vehicleCosts:
        "Insurance, charging, maintenance, winter tires and home electricity if included.",
      usedCarDetails:
        "Mileage, battery state, warranty, first registration and remaining useful life.",
    },
    appHintIntro:
      "Добавьте больше данных, когда они есть. От этого расчёт становится точнее:",
  },
} as const;

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends (...args: never[]) => unknown
      ? T
      : { [K in keyof T]: Widen<T[K]> };

const STORAGE_KEY = "gmbh-ev-calculator-state-v1";

const DEFAULT_APP_STATE: AppState = {
  scenarios: DEFAULT_SCENARIOS,
  selectedId: DEFAULT_SCENARIOS[0].id,
  settings: DEFAULT_TAX_SETTINGS,
  language: "de",
};

function normalizeLanguage(value: unknown): LanguageCode {
  return value === "en" || value === "ru" ? value : "de";
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function extractAppStateInput(raw: unknown): Partial<AppState> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const candidate = raw as { state?: unknown };
  if (candidate.state && typeof candidate.state === "object" && !Array.isArray(candidate.state)) {
    return candidate.state as Partial<AppState>;
  }
  return raw as Partial<AppState>;
}

function normalizeAppStateFromInput(raw: unknown): AppState {
  const parsed = extractAppStateInput(raw);

  const scenarios: LegacyScenarioInput[] =
    Array.isArray(parsed.scenarios) && parsed.scenarios.length > 0
      ? (parsed.scenarios as LegacyScenarioInput[])
      : (DEFAULT_SCENARIOS as LegacyScenarioInput[]);
  const legacyOtherGewstAddbacks = scenarios
    .map((scenario) => scenario.lease?.otherAnnualGewstAddbacks ?? scenario.credit?.otherAnnualGewstAddbacks)
    .find((value): value is number => typeof value === "number" && value > 0);
  const parsedSettings = parsed.settings as Partial<TaxSettings> | undefined;
  const parsedOtherGewstAddbacks = finiteNumber(parsedSettings?.otherAnnualGewstAddbacks, Number.NaN);
  const selectedScenario =
    typeof parsed.selectedId === "string"
      ? scenarios.find((item) => item.id === parsed.selectedId) ?? scenarios[0]
      : scenarios[0];
  const settings = {
    ...DEFAULT_TAX_SETTINGS,
    ...(parsedSettings ?? {}),
    baseAnnualProfit: finiteNumber(parsedSettings?.baseAnnualProfit, DEFAULT_TAX_SETTINGS.baseAnnualProfit),
    corporationTaxRate: finiteNumber(parsedSettings?.corporationTaxRate, DEFAULT_TAX_SETTINGS.corporationTaxRate),
    solidarityRate: finiteNumber(parsedSettings?.solidarityRate, DEFAULT_TAX_SETTINGS.solidarityRate),
    gewstMeasureRate: finiteNumber(parsedSettings?.gewstMeasureRate, DEFAULT_TAX_SETTINGS.gewstMeasureRate),
    berlinHebesatz: finiteNumber(parsedSettings?.berlinHebesatz, DEFAULT_TAX_SETTINGS.berlinHebesatz),
    gewstAddbackAllowance: finiteNumber(
      parsedSettings?.gewstAddbackAllowance,
      DEFAULT_TAX_SETTINGS.gewstAddbackAllowance,
    ),
    otherAnnualGewstAddbacks: Number.isFinite(parsedOtherGewstAddbacks)
      ? parsedOtherGewstAddbacks
      : (legacyOtherGewstAddbacks ?? DEFAULT_TAX_SETTINGS.otherAnnualGewstAddbacks),
    vatRate: finiteNumber(
      parsedSettings?.vatRate,
      finiteNumber(selectedScenario?.car?.vatRate, DEFAULT_TAX_SETTINGS.vatRate),
    ),
    usedVatMode:
      parsedSettings?.usedVatMode === "regular" || parsedSettings?.usedVatMode === "none"
        ? parsedSettings.usedVatMode
        : (selectedScenario?.car?.vatMode ?? DEFAULT_TAX_SETTINGS.usedVatMode),
    afaYears: Math.max(
      1,
      Math.round(
        finiteNumber(
          parsedSettings?.afaYears,
          finiteNumber(selectedScenario?.car?.afaYears, DEFAULT_TAX_SETTINGS.afaYears),
        ),
      ),
    ),
    comparisonStartMonth: normalizeMonthKey(
      parsedSettings?.comparisonStartMonth,
      DEFAULT_TAX_SETTINGS.comparisonStartMonth,
    ),
  };
  const selectedId =
    typeof parsed.selectedId === "string" && scenarios.some((item) => item.id === parsed.selectedId)
      ? parsed.selectedId
      : scenarios[0].id;

  const normalizedScenarios = scenarios.map((scenario) => ({
      ...scenario,
      car: {
        ...scenario.car,
        condition: scenario.car.condition ?? (scenario.kind === "credit-used" ? "used" : "new"),
        startMonth: finiteNumber(scenario.car.startMonth, 1),
        startYear: Math.round(
          finiteNumber(scenario.car.startYear, finiteNumber(scenario.car.firstRegistrationYear, new Date().getFullYear())),
        ),
        blpGross: finiteNumber(scenario.car.blpGross, 0),
        purchasePriceGross: finiteNumber(scenario.car.purchasePriceGross, 0),
        vatRate: settings.vatRate,
        vatMode: scenario.kind === "credit-used" ? settings.usedVatMode : "regular",
        firstRegistrationMonth: Math.max(1, Math.min(12, Math.round(finiteNumber(scenario.car.firstRegistrationMonth, 1)))),
        firstRegistrationYear: finiteNumber(scenario.car.firstRegistrationYear, new Date().getFullYear()),
        afaYears: settings.afaYears,
        privateUseMethod: scenario.car.privateUseMethod ?? "auto-bev",
        privateUseRate: finiteNumber(scenario.car.privateUseRate, 0.0025),
        commuteDistanceKm: finiteNumber(scenario.car.commuteDistanceKm, 0),
        commuteDistanceKmEnabled:
          typeof scenario.car.commuteDistanceKmEnabled === "boolean"
            ? scenario.car.commuteDistanceKmEnabled
            : finiteNumber(scenario.car.commuteDistanceKm, 0) > 0,
        commuteMonthsPerYear: finiteNumber(scenario.car.commuteMonthsPerYear, 12),
        commuteMonthsPerYearEnabled:
          typeof scenario.car.commuteMonthsPerYearEnabled === "boolean"
            ? scenario.car.commuteMonthsPerYearEnabled
            : finiteNumber(scenario.car.commuteDistanceKm, 0) > 0,
        commuteDaysPerMonth: finiteNumber(scenario.car.commuteDaysPerMonth, 0),
        commuteDaysPerMonthEnabled:
          typeof scenario.car.commuteDaysPerMonthEnabled === "boolean"
            ? scenario.car.commuteDaysPerMonthEnabled
            : false,
        annualInsuranceGross: finiteNumber(scenario.car.annualInsuranceGross, 0),
        annualInsuranceGrossEnabled:
          typeof scenario.car.annualInsuranceGrossEnabled === "boolean"
            ? scenario.car.annualInsuranceGrossEnabled
            : finiteNumber(scenario.car.annualInsuranceGross, 0) > 0,
        annualChargingGross: finiteNumber(scenario.car.annualChargingGross, 0),
        annualChargingGrossEnabled:
          typeof scenario.car.annualChargingGrossEnabled === "boolean"
            ? scenario.car.annualChargingGrossEnabled
            : finiteNumber(scenario.car.annualChargingGross, 0) > 0,
        annualMaintenanceGross: finiteNumber(scenario.car.annualMaintenanceGross, 0),
        annualMaintenanceGrossEnabled:
          typeof scenario.car.annualMaintenanceGrossEnabled === "boolean"
            ? scenario.car.annualMaintenanceGrossEnabled
            : finiteNumber(scenario.car.annualMaintenanceGross, 0) > 0,
        annualTiresGross: finiteNumber(scenario.car.annualTiresGross, 0),
        annualTiresGrossEnabled:
          typeof scenario.car.annualTiresGrossEnabled === "boolean"
            ? scenario.car.annualTiresGrossEnabled
            : finiteNumber(scenario.car.annualTiresGross, 0) > 0,
        salePriceMode: (scenario.car.salePriceMode === "net"
          ? "net"
          : finiteNumber(scenario.car.salePriceNet, 0) > 0
            ? "net"
            : "gross") as SalePriceMode,
        salePriceNet: finiteNumber(scenario.car.salePriceNet, 0),
        salePriceNetEnabled:
          typeof scenario.car.salePriceNetEnabled === "boolean"
            ? scenario.car.salePriceNetEnabled
            : finiteNumber(scenario.car.salePriceNet, 0) > 0,
        saleAfterMonths: finiteNumber(scenario.car.saleAfterMonths, 0),
        saleAfterMonthsEnabled:
          typeof scenario.car.saleAfterMonthsEnabled === "boolean"
            ? scenario.car.saleAfterMonthsEnabled
            : false,
      },
      lease: scenario.lease
        ? {
            termMonths: finiteNumber(scenario.lease.termMonths, 36),
            monthlyRateGross: finiteNumber(scenario.lease.monthlyRateGross, 0),
            specialPaymentGross: finiteNumber(scenario.lease.specialPaymentGross, 0),
            feesGross: finiteNumber(scenario.lease.feesGross, 0),
          }
        : undefined,
      credit: scenario.credit
        ? {
            termMonths: finiteNumber(scenario.credit.termMonths, scenario.kind === "credit-used" ? 36 : 48),
            downPaymentGross: finiteNumber(scenario.credit.downPaymentGross, 0),
          annualInterestRate: finiteNumber(scenario.credit.annualInterestRate, 0),
          balloonGross: finiteNumber(scenario.credit.balloonGross, 0),
          acquisitionCostsGross: finiteNumber(scenario.credit.acquisitionCostsGross, 0),
          feesGross: finiteNumber(scenario.credit.feesGross, 0),
          offeredMonthlyPaymentGross: finiteNumber(scenario.credit.offeredMonthlyPaymentGross, 0),
        }
      : undefined,
    }));

  return {
    scenarios: normalizedScenarios,
    selectedId,
    settings,
    language: normalizeLanguage(parsed.language),
  };
}

function loadAppState(): AppState {
  if (typeof window === "undefined") return DEFAULT_APP_STATE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_STATE;
    return normalizeAppStateFromInput(JSON.parse(raw));
  } catch {
    return DEFAULT_APP_STATE;
  }
}

function newScenario(kind: ScenarioKind, ui: UiText = UI_TEXT.de, settings: TaxSettings = DEFAULT_TAX_SETTINGS): ScenarioInput {
  const base: CarInput = {
    name:
      kind === "lease"
        ? ui.scenarioKinds.lease
        : kind === "credit-new"
          ? ui.scenarioKinds.creditNew
          : ui.scenarioKinds.creditUsed,
    condition: kind === "credit-used" ? "used" : "new",
    startMonth: 1,
    startYear: new Date().getFullYear(),
    blpGross: 55000,
    purchasePriceGross: kind === "credit-used" ? 35000 : 55000,
    vatRate: settings.vatRate,
    vatMode: kind === "credit-used" ? settings.usedVatMode : "regular",
    firstRegistrationMonth: 1,
    firstRegistrationYear: kind === "credit-used" ? 2023 : 2026,
    afaYears: settings.afaYears,
    privateUseMethod: "auto-bev",
    privateUseRate: 0.0025,
    commuteDistanceKm: 0,
    commuteDistanceKmEnabled: false,
    commuteMonthsPerYear: 12,
    commuteMonthsPerYearEnabled: false,
    commuteDaysPerMonth: 0,
    commuteDaysPerMonthEnabled: false,
    annualInsuranceGross: kind === "credit-used" ? 1000 : 1200,
    annualInsuranceGrossEnabled: false,
    annualChargingGross: 900,
    annualChargingGrossEnabled: false,
    annualMaintenanceGross: kind === "credit-used" ? 650 : 450,
    annualMaintenanceGrossEnabled: false,
    annualTiresGross: kind === "credit-used" ? 300 : 250,
    annualTiresGrossEnabled: false,
    salePriceMode: "gross",
    salePriceNet: 0,
    salePriceNetEnabled: false,
    saleAfterMonths: 0,
    saleAfterMonthsEnabled: false,
  };

  if (kind === "lease") {
    return {
      id: crypto.randomUUID(),
      kind,
      car: base,
      lease: {
        termMonths: 36,
        monthlyRateGross: 650,
        specialPaymentGross: 0,
        feesGross: 990,
      },
    };
  }

  return {
    id: crypto.randomUUID(),
    kind,
    car: base,
    credit: {
      termMonths: kind === "credit-used" ? 36 : 48,
      downPaymentGross: 7500,
      annualInterestRate: kind === "credit-used" ? 0.065 : 0.049,
      balloonGross: kind === "credit-used" ? 14000 : 22000,
      acquisitionCostsGross: kind === "credit-used" ? 590 : 990,
      feesGross: 490,
      offeredMonthlyPaymentGross: 0,
    },
  };
}

function TaxSettingsModal({
  open,
  settings,
  onClose,
  onChange,
  ui,
}: {
  open: boolean;
  settings: TaxSettings;
  onClose: () => void;
  onChange: (patch: Partial<TaxSettings>) => void;
  ui: UiText;
}) {
  if (!open) return null;

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label={ui.sections.taxSettings}>
      <div className="modalShell modalShellSlim">
        <div className="modalHeader">
          <div>
            <h2>{ui.sections.taxSettings}</h2>
          </div>
          <button className="iconButton" onClick={onClose} aria-label={ui.modals.closeTaxSettings}>
            <X size={18} />
          </button>
        </div>

        <div className="modalContent singleColumn">
          <section className="panel">
            <div className="formGrid">
              <NumberField
                label={ui.fields.profitBeforeCar}
                value={settings.baseAnnualProfit}
                onChange={(baseAnnualProfit) => onChange({ baseAnnualProfit })}
                suffix="EUR p.a."
                help={ui.help.profitBeforeCar}
              />
              <MonthField
                label={ui.fields.calculationStartMonth}
                value={settings.comparisonStartMonth}
                onChange={(comparisonStartMonth) => onChange({ comparisonStartMonth })}
                help={ui.help.calculationStartMonth}
              />
              <NumberField
                label={ui.fields.gewstHebesatz}
                value={settings.berlinHebesatz}
                step={1}
                integer
                onChange={(value) => onChange({ berlinHebesatz: Math.max(0, Math.round(value)) })}
                suffix="%"
                help={ui.help.gewstHebesatz}
              />
              <NumberField
                label={ui.fields.vatRate}
                value={settings.vatRate * 100}
                step={0.1}
                onChange={(value) => onChange({ vatRate: value / 100 })}
                suffix="%"
                help={ui.help.vatRate}
              />
              <SelectField<VatMode>
                label={ui.fields.usedVatMode}
                value={settings.usedVatMode}
                options={[
                  { value: "regular", label: ui.options.regularVat },
                  { value: "none", label: ui.options.noVat },
                ]}
                onChange={(usedVatMode) => onChange({ usedVatMode })}
                help={ui.help.usedVatMode}
              />
              <NumberField
                label={ui.fields.afaYears}
                value={settings.afaYears}
                step={1}
                integer
                onChange={(afaYears) => onChange({ afaYears: Math.max(1, afaYears) })}
                suffix="Jahre"
                help={ui.help.afaYears}
              />
              <NumberField
                label={ui.fields.otherGewstAddbacks}
                value={settings.otherAnnualGewstAddbacks}
                onChange={(otherAnnualGewstAddbacks) =>
                  onChange({ otherAnnualGewstAddbacks: Math.max(0, otherAnnualGewstAddbacks) })
                }
                suffix="EUR p.a."
                help={ui.help.otherGewstAddbacks}
              />
              <NumberField
                label={ui.fields.kst}
                value={settings.corporationTaxRate * 100}
                step={0.1}
                onChange={(value) => onChange({ corporationTaxRate: value / 100 })}
                suffix="%"
                help={ui.help.kst}
              />
              <NumberField
                label={ui.fields.soliOnKSt}
                value={settings.solidarityRate * 100}
                step={0.1}
                onChange={(value) => onChange({ solidarityRate: value / 100 })}
                suffix="%"
                help={ui.help.soliOnKSt}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
export default function App() {
  const [state, setState] = useState<AppState>(loadAppState);
  const [taxSettingsOpen, setTaxSettingsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const ui = UI_TEXT[state.language];

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (taxSettingsOpen || compareOpen) {
      const { overflow, overscrollBehavior } = document.body.style;
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      return () => {
        document.body.style.overflow = overflow;
        document.body.style.overscrollBehavior = overscrollBehavior;
      };
    }

    document.body.style.overflow = "";
    document.body.style.overscrollBehavior = "";
    return undefined;
  }, [taxSettingsOpen, compareOpen]);

  useEffect(() => {
    if (!taxSettingsOpen && !compareOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setTaxSettingsOpen(false);
      setCompareOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [taxSettingsOpen, compareOpen]);

  const selected = state.scenarios.find((scenario) => scenario.id === state.selectedId) ?? state.scenarios[0];
  const results = useMemo(
    () => state.scenarios.map((scenario) => calculateScenario(scenario, state.settings)),
    [state.scenarios, state.settings],
  );
  const selectedResult = results.find((result) => result.id === selected?.id);
  const selectedComparisonStartMonth =
    state.settings.comparisonStartMonth !== DEFAULT_TAX_SETTINGS.comparisonStartMonth
      ? normalizeMonthKey(state.settings.comparisonStartMonth)
      : selected && Number.isFinite(selected.car.startYear) && Number.isFinite(selected.car.startMonth)
        ? formatMonthKey(selected.car.startYear, selected.car.startMonth)
        : state.settings.comparisonStartMonth;

  function updateScenario(next: ScenarioInput) {
    setState((current) => ({
      ...current,
      scenarios: current.scenarios.map((scenario) => (scenario.id === next.id ? next : scenario)),
    }));
  }

  function updateSettings(patch: Partial<TaxSettings>) {
    setState((current) => {
      const nextSettings = { ...current.settings, ...patch };

      return {
        ...current,
        settings: nextSettings,
        scenarios: current.scenarios.map((scenario) => ({
          ...scenario,
          car: {
            ...scenario.car,
            vatRate: nextSettings.vatRate,
            vatMode: scenario.car.condition === "used" ? nextSettings.usedVatMode : "regular",
            afaYears: nextSettings.afaYears,
          },
        })),
      };
    });
  }

  function updateLanguage(language: LanguageCode) {
    setState((current) => ({
      ...current,
      language,
    }));
  }

  function exportStateAsJson() {
    const payload: AppStateExportPayload = {
      app: "gmbh-ev-compare",
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gmbh-ev-compare-${currentDateStamp()}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importStateFromJson(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      setState(normalizeAppStateFromInput(parsed));
    } catch {
      window.alert(ui.messages.invalidImport);
    }
  }

  function addScenario(kind: ScenarioKind) {
    const next = newScenario(kind, ui, state.settings);
    setState((current) => ({
      ...current,
      scenarios: [...current.scenarios, next],
      selectedId: next.id,
    }));
  }

  function duplicateScenario() {
    if (!selected) return;
    const next = {
      ...selected,
      id: crypto.randomUUID(),
      car: { ...selected.car, name: `${selected.car.name} Kopie` },
      lease: selected.lease ? { ...selected.lease } : undefined,
      credit: selected.credit ? { ...selected.credit } : undefined,
    };
    setState((current) => ({
      ...current,
      scenarios: [...current.scenarios, next],
      selectedId: next.id,
    }));
  }

  function deleteScenario() {
    if (!selected || state.scenarios.length <= 1) return;
    const remaining = state.scenarios.filter((scenario) => scenario.id !== selected.id);
    setState((current) => ({
      ...current,
      scenarios: remaining,
      selectedId: remaining[0].id,
    }));
  }

  return (
    <>
      <main className="appShell">
        <aside className="sidebar">
          <div className="brand">
            <h1>{ui.appName}</h1>
          </div>

          <div className="buttonGrid sidebarActions">
            <button className="primary" onClick={() => setTaxSettingsOpen(true)}>
              <Settings2 size={16} /> {ui.sidebar.taxSettings}
            </button>
            <button className="primary" onClick={() => setCompareOpen(true)}>
              <BarChart3 size={16} /> {ui.sidebar.compare}
            </button>
            <button onClick={exportStateAsJson}>
              <Download size={16} /> {ui.sidebar.exportJson}
            </button>
            <button onClick={() => importInputRef.current?.click()}>
              <Upload size={16} /> {ui.sidebar.importJson}
            </button>
          </div>
          <input
            ref={importInputRef}
            className="fileInput"
            type="file"
            accept=".json,application/json"
            onChange={importStateFromJson}
            tabIndex={-1}
            aria-hidden="true"
          />

          <div className="scenarioList">
            {state.scenarios.map((scenario) => {
              const result = results.find((item) => item.id === scenario.id);
              return (
                <button
                  className={scenario.id === selected?.id ? "scenario active" : "scenario"}
                  key={scenario.id}
                  onClick={() =>
                    setState((current) => ({ ...current, selectedId: scenario.id }))
                  }
                >
                  <span>{scenario.car.name}</span>
                  <b>
                    {result ? eur(result.afterTaxMonthlyEquivalent) : "0 EUR"}
                    {ui.summary.perMonth}
                  </b>
                  <em>{scenarioTitle(scenario.kind, ui, "summary")}</em>
                </button>
              );
            })}
          </div>

          <div className="buttonGrid">
            <button onClick={() => addScenario("lease")}>
              <Plus size={16} /> {ui.sidebar.addLease}
            </button>
            <button onClick={() => addScenario("credit-new")}>
              <Plus size={16} /> {ui.sidebar.addCreditNew}
            </button>
            <button onClick={() => addScenario("credit-used")}>
              <Plus size={16} /> {ui.sidebar.addCreditUsed}
            </button>
          </div>

          <div className="sidebarFooter">
            <div className="languageToggle sidebarLanguageToggle" role="group" aria-label={ui.language}>
              {(["de", "en", "ru"] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  className={state.language === language ? "langButton active" : "langButton"}
                  onClick={() => updateLanguage(language)}
                >
                  {ui.languages[language]}
                </button>
              ))}
            </div>
            <a href="https://felev.eu/impressum" target="_blank" rel="noreferrer">
              {ui.sidebar.impressum}
            </a>
            <a href="https://felev.eu/datenschutzerklaerung" target="_blank" rel="noreferrer">
              {ui.sidebar.privacy}
            </a>
          </div>
        </aside>

        <section className="content">
          {selected ? (
            <ScenarioEditorView
              selected={selected}
              selectedResult={selectedResult}
              onUpdateScenario={updateScenario}
              onDuplicateScenario={duplicateScenario}
              onDeleteScenario={deleteScenario}
              ui={ui}
            />
          ) : (
            <div className="emptyState">{ui.modals.noScenarioSelected}</div>
          )}
        </section>
      </main>

      <TaxSettingsModal
        open={taxSettingsOpen}
        settings={state.settings}
        onClose={() => setTaxSettingsOpen(false)}
        onChange={updateSettings}
        ui={ui}
      />

      <CompareModalView
        open={compareOpen}
        scenarios={state.scenarios}
        results={results}
        comparisonStartMonth={selectedComparisonStartMonth}
        onClose={() => setCompareOpen(false)}
        ui={ui}
      />
    </>
  );
}
