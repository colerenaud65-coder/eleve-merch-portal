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

export function preorderPhase(
  event: {
    complianceConfirmed: boolean;
    preorderOpensAt: Date;
    preorderClosesAt: Date;
  },
  now = new Date(),
): PreorderPhase {
  if (!event.complianceConfirmed) return "compliance";
  if (now < event.preorderOpensAt) return "upcoming";
  if (now >= event.preorderClosesAt) return "closed";
  return "open";
}
