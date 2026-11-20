import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/shell";
import { getCurrentAccount } from "@/server/auth";

export const metadata: Metadata = { title: "Desk" };

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount();
  if (!account || account.role !== "admin" || account.status !== "approved") redirect("/account");
  return <AdminShell>{children}</AdminShell>;
}
