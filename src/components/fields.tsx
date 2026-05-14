import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { eur } from "../lib/calculator";

export type TaxBreakdownUi = {
  summary: {
    taxShort: string;
    beforeTaxEquivalent: string;
    taxSavingMonthly: string;
    afterTaxEquivalent: string;
  };
  compareRows: {
    netCash: string;
    taxSaving: string;
    yearAfterTax: string;
    afterTaxMonth: string;
  };
};

type TooltipPosition = { top: number; left: number; placement: "top" | "bottom" };

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  integer?: boolean;
  help?: string;
  prepend?: ReactNode;
  optionalToggle?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
};

function displayNumberValue(value: number, integer: boolean) {
  if (!Number.isFinite(value)) return 0;
  if (integer) return Math.round(value);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  suffix,
  disabled,
  integer = false,
  help,
  prepend,
  optionalToggle,
}: NumberFieldProps) {
  const inputId = useId();
  const toggleId = `${inputId}-toggle`;
  const isDisabled = disabled || (optionalToggle ? !optionalToggle.checked : false);

  return (
    <div className="field">
      <div className="fieldLabelRow">
        <label htmlFor={inputId}>{label}</label>
        {help ? <TooltipButton help={help} label={label} /> : null}
      </div>
      <div className="inputWrap">
        {optionalToggle ? (
          <label className="fieldToggleControl" htmlFor={toggleId}>
            <input
              id={toggleId}
              className="fieldToggleInput"
              type="checkbox"
              checked={optionalToggle.checked}
              onChange={(event) => optionalToggle.onChange(event.target.checked)}
              aria-label={label}
            />
            <span className="fieldToggleTrack">
              <span className="fieldToggleThumb" />
            </span>
          </label>
        ) : null}
        {prepend ?? null}
        <input
          id={inputId}
          type="number"
          value={displayNumberValue(value, integer)}
          step={step}
          inputMode={integer ? "numeric" : undefined}
          disabled={isDisabled}
          onChange={(event) => {
            const next = Number(event.target.value);
            const normalized = Number.isFinite(next) ? next : 0;
            onChange(integer ? Math.round(normalized) : normalized);
          }}
        />
        {suffix ? <b>{suffix}</b> : null}
      </div>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
}) {
  const inputId = useId();
  return (
    <div className="field">
      <div className="fieldLabelRow">
        <label htmlFor={inputId}>{label}</label>
        {help ? <TooltipButton help={help} label={label} /> : null}
      </div>
      <input id={inputId} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function MonthField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
}) {
  const inputId = useId();
  return (
    <div className="field">
      <div className="fieldLabelRow">
        <label htmlFor={inputId}>{label}</label>
        {help ? <TooltipButton help={help} label={label} /> : null}
      </div>
      <input
        id={inputId}
        type="month"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function MonthYearField({
  label,
  monthValue,
  yearValue,
  onMonthChange,
  onYearChange,
  help,
}: {
  label: string;
  monthValue: number;
  yearValue: number;
  onMonthChange: (value: number) => void;
  onYearChange: (value: number) => void;
  help?: string;
}) {
  const monthId = useId();
  const yearId = useId();
  return (
    <div className="field">
      <div className="fieldLabelRow">
        <label>{label}</label>
        {help ? <TooltipButton help={help} label={label} /> : null}
      </div>
      <div className="datePair">
        <input
          id={monthId}
          type="number"
          min={1}
          max={12}
          step={1}
          inputMode="numeric"
          value={Number.isFinite(monthValue) ? monthValue : 1}
          onChange={(event) => {
            const next = Number(event.target.value);
            onMonthChange(Number.isFinite(next) ? Math.max(1, Math.min(12, Math.round(next))) : 1);
          }}
          aria-label={`${label} month`}
        />
        <input
          id={yearId}
          type="number"
          step={1}
          inputMode="numeric"
          value={Number.isFinite(yearValue) ? yearValue : new Date().getFullYear()}
          onChange={(event) => {
            const next = Number(event.target.value);
            onYearChange(Number.isFinite(next) ? Math.round(next) : new Date().getFullYear());
          }}
          aria-label={`${label} year`}
        />
      </div>
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  help?: string;
}) {
  const inputId = useId();
  return (
    <div className="field">
      <div className="fieldLabelRow">
        <label htmlFor={inputId}>{label}</label>
        {help ? <TooltipButton help={help} label={label} /> : null}
      </div>
      <select id={inputId} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ToggleField<T extends string>({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  help?: string;
}) {
  const inputId = useId();
  return (
    <div className="field">
      <div className="fieldLabelRow">
        <label htmlFor={inputId}>{label}</label>
        {help ? <TooltipButton help={help} label={label} /> : null}
      </div>
      <div className="modeToggleGroup" role="group" aria-label={label}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className={`modeToggleButton${active ? " isActive" : ""}`}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InlineToggleField<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`inlineModeToggleGroup${disabled ? " isDisabled" : ""}`}
      role="group"
      aria-label="Price mode"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`inlineModeToggleButton${active ? " isActive" : ""}`}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function TooltipButton({ help, label }: { help: string; label: string }) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = () => {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 12;
    const tooltipWidth = Math.min(320, Math.max(220, window.innerWidth - viewportPadding * 2));
    const centerX = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(centerX, viewportPadding + tooltipWidth / 2),
      window.innerWidth - viewportPadding - tooltipWidth / 2,
    );
    const placeBelow = rect.top < 180;
    const top = placeBelow ? rect.bottom + 8 : rect.top - 8;
    setPosition({ top, left, placement: placeBelow ? "bottom" : "top" });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="helpButton"
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`${label}: ${help}`}
        onMouseEnter={() => {
          updatePosition();
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          updatePosition();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
      >
        <CircleHelp size={14} />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              className={`floatingTooltip ${position.placement === "bottom" ? "placementBottom" : "placementTop"}`}
              style={{ top: `${position.top}px`, left: `${position.left}px` }}
              role="tooltip"
            >
              {help}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function formatTaxNote(value: number, ui: TaxBreakdownUi) {
  const amount = eur(Math.abs(value));
  return `${value >= 0 ? "-" : "+"} ${amount} ${ui.summary.taxShort}`;
}

export function taxBreakdownTooltip({
  beforeTaxLabel,
  beforeTax,
  taxSavingLabel,
  taxSaving,
  afterTaxLabel,
  afterTax,
  kstSaving,
  soliSaving,
  gewstSaving,
}: {
  beforeTaxLabel: string;
  beforeTax: number;
  taxSavingLabel: string;
  taxSaving: number;
  afterTaxLabel: string;
  afterTax: number;
  kstSaving: number;
  soliSaving: number;
  gewstSaving: number;
}) {
  return [
    `${beforeTaxLabel}: ${eur(beforeTax)}`,
    `${taxSavingLabel}: ${eur(Math.max(0, taxSaving))}`,
    `${afterTaxLabel}: ${eur(afterTax)}`,
    `KSt: ${eur(kstSaving)}`,
    `Soli: ${eur(soliSaving)}`,
    `GewSt: ${eur(gewstSaving)}`,
  ].join("\n");
}

export function BreakdownValue({
  value,
  note,
  tooltip,
}: {
  value: string;
  note?: string;
  tooltip: string;
}) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = () => {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 12;
    const tooltipWidth = Math.min(320, Math.max(220, window.innerWidth - viewportPadding * 2));
    const centerX = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(centerX, viewportPadding + tooltipWidth / 2),
      window.innerWidth - viewportPadding - tooltipWidth / 2,
    );
    const placeBelow = rect.top < 180;
    const top = placeBelow ? rect.bottom + 8 : rect.top - 8;
    setPosition({ top, left, placement: placeBelow ? "bottom" : "top" });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [open]);

  return (
    <>
      <div
        ref={anchorRef}
        className="breakdownValue"
        tabIndex={0}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={note ? `${value} ${note}` : value}
        onMouseEnter={() => {
          updatePosition();
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          updatePosition();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
      >
        <strong>{value}</strong>
        {note ? <em>{note}</em> : null}
      </div>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              className={`floatingTooltip ${position.placement === "bottom" ? "placementBottom" : "placementTop"}`}
              style={{ top: `${position.top}px`, left: `${position.left}px` }}
              role="tooltip"
            >
              {tooltip.split("\n").map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function SummaryMetric({
  label,
  value,
  note,
  tooltip,
}: {
  label: string;
  value: string;
  note?: string;
  tooltip: string;
}) {
  return (
    <div className="summaryMetric">
      <span>{label}</span>
      <BreakdownValue value={value} note={note} tooltip={tooltip} />
    </div>
  );
}
