export const DEPOSIT_RATIO = 0.5;
export const HOLD_HOURS = 48;

export function holdExpiry(from = new Date()) {
  return new Date(from.getTime() + HOLD_HOURS * 60 * 60 * 1000);
}

export function termsDays(terms: string) {
  if (terms === "net_15") return 15;
  if (terms === "net_30") return 30;
  return 0;
}

export function formatMoney(cents: number, currency: string) {
  const amount = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
  return `${amount} ${currency}`;
}

export function depositDue(subtotalCents: number) {
  return Math.round(subtotalCents * DEPOSIT_RATIO);
}

export function dollarsToCents(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? "").trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}
