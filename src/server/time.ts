export function formatWhen(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function zonedLocalToUtc(local: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
    throw new Error(`Expected a local time, received ${local}.`);
  }
  const asUtc = new Date(`${local}:00Z`);
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(asUtc);
  const part = Object.fromEntries(
    formatted.filter((item) => item.type !== "literal").map((item) => [item.type, item.value]),
  );
  const hour = part.hour === "24" ? "00" : part.hour;
  const zonedAsUtc = Date.UTC(
    Number(part.year),
    Number(part.month) - 1,
    Number(part.day),
    Number(hour),
    Number(part.minute),
    Number(part.second),
  );
  return new Date(asUtc.getTime() - (zonedAsUtc - asUtc.getTime()));
}

export function todayInZone(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function ageInZone(dob: string, timeZone: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return -1;
  const [year, month, day] = dob.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return -1;
  }
  const today = todayInZone(timeZone, now);
  const [y2, m2, d2] = today.split("-").map(Number);
  if (dob > today) return -1;
  let age = y2 - year;
  if (m2 < month || (m2 === month && d2 < day)) age -= 1;
  return age;
}

export type PreorderPhase = "compliance" | "upcoming" | "open" | "closed";

export function earlyAccessAt(event: { earlyAccessOpensAt?: Date | null; preorderOpensAt: Date }) {
  return event.earlyAccessOpensAt ?? new Date(event.preorderOpensAt.getTime() - 3 * 60 * 60 * 1000);
}

export function preorderPhase(
  event: {
    complianceConfirmed: boolean;
    preorderOpensAt: Date;
    preorderClosesAt: Date;
    earlyAccessOpensAt?: Date | null;
  },
  now = new Date(),
  early = false,
): PreorderPhase {
  if (!event.complianceConfirmed) return "compliance";
  if (now >= event.preorderClosesAt) return "closed";
  if (now >= event.preorderOpensAt) return "open";
  if (early && now >= earlyAccessAt(event)) return "open";
  return "upcoming";
}

export function formatLocalInput(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const part = Object.fromEntries(
    parts.filter((item) => item.type !== "literal").map((item) => [item.type, item.value]),
  );
  const hour = part.hour === "24" ? "00" : part.hour;
  return `${part.year}-${part.month}-${part.day}T${hour}:${part.minute}`;
}
