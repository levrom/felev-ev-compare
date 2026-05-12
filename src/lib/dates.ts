export function currentDateStamp() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function normalizeMonthKey(value: unknown, fallback = currentMonthKey()) {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) return value;
  return fallback;
}

export function formatMonthKey(year: number, month: number) {
  return `${year}-${String(Math.max(1, Math.min(12, Math.round(month)))).padStart(2, "0")}`;
}

export function addMonthsToMonthKey(monthKey: string, offset: number) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;

  const date = new Date(year, month - 1 + offset, 1);
  return formatMonthKey(date.getFullYear(), date.getMonth() + 1);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
