export const DEPOSIT_RATIO = 0.5;

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
