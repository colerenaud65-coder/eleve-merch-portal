import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

import { customerRetailRegions } from "@/db/catalog";

const COOKIE = "eleve_gate";

export type Gate = {
  regionSlug: string;
  country: "CA" | "US";
  dob: string;
  confirmedAt: string;
};

function sign(payload: string, secret: string) {
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

function verify(raw: string, secret: string): Gate | null {
  const index = raw.lastIndexOf(".");
  if (index <= 0) return null;
  const payload = raw.slice(0, index);
  const mac = raw.slice(index + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Gate;
    if (!parsed.regionSlug || !parsed.dob || (parsed.country !== "CA" && parsed.country !== "US")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function readGate(): Promise<(Gate & { regionName: string; minimumAge: number }) | null> {
  const secret = process.env.APP_SECRET;
  if (!secret) return null;
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const gate = verify(raw, secret);
  if (!gate) return null;
  const region = customerRetailRegions.find((item) => item.slug === gate.regionSlug);
  if (!region || region.country !== gate.country) return null;
  return { ...gate, regionName: region.name, minimumAge: region.minimumAge };
}

export async function writeGate(gate: Gate) {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set.");
  const payload = Buffer.from(JSON.stringify(gate), "utf8").toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, sign(payload, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearGate() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
