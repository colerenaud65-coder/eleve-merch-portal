import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

import { customerRetailRegions } from "@/db/catalog";
import { getCurrentAccount } from "@/server/auth";

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
    if (!parsed.regionSlug || typeof parsed.dob !== "string" || (parsed.country !== "CA" && parsed.country !== "US")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function readGate(): Promise<(Gate & { regionName: string; minimumAge: number }) | null> {
  const secret = process.env.APP_SECRET;
  const raw = secret ? (await cookies()).get(COOKIE)?.value : undefined;
  const gate = secret && raw ? verify(raw, secret) : null;
  if (gate) {
    const region = customerRetailRegions.find((item) => item.slug === gate.regionSlug);
    if (region && region.country === gate.country) {
      return { ...gate, regionName: region.name, minimumAge: region.minimumAge };
    }
  }
  return signedInRegion();
}

async function signedInRegion() {
  const account = await getCurrentAccount().catch(() => null);
  if (!account) return null;
  const region = customerRetailRegions[0];
  if (!region) return null;
  return {
    regionSlug: region.slug,
    country: region.country,
    dob: "",
    confirmedAt: "",
    regionName: region.name,
    minimumAge: region.minimumAge,
  };
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
