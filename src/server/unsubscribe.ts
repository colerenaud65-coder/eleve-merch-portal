import { createHmac, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { accounts } from "@/db/schema";

function secret() {
  return process.env.APP_SECRET ?? "";
}

export function signUnsubscribe(accountId: string) {
  const key = secret();
  if (!key) return null;
  const mac = createHmac("sha256", key).update(`unsub:${accountId}`).digest("base64url");
  return `${accountId}.${mac}`;
}

export function readUnsubscribe(token: string) {
  const key = secret();
  const index = token.lastIndexOf(".");
  if (!key || index <= 0) return null;
  const accountId = token.slice(0, index);
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return null;
  const mac = token.slice(index + 1);
  const expected = createHmac("sha256", key).update(`unsub:${accountId}`).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return accountId;
}

export async function unsubscribeAccount(token: string) {
  const accountId = readUnsubscribe(token);
  if (!accountId) return false;
  const [row] = await getDb().select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!row) return false;
  await getDb()
    .update(accounts)
    .set({ marketingConsent: false, unsubscribedAt: new Date() })
    .where(eq(accounts.id, accountId));
  return true;
}
