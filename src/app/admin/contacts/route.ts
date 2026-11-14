import { getCurrentAccount } from "@/server/auth";
import { consentedContacts } from "@/server/growth";
import { getRegionBySlug } from "@/server/queries";

function cell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const account = await getCurrentAccount();
  if (!account || account.role !== "admin" || account.status !== "approved") {
    return new Response("Forbidden", { status: 403 });
  }
  const slug = new URL(request.url).searchParams.get("region") ?? "";
  const region = slug ? await getRegionBySlug(slug) : null;
  const rows = await consentedContacts(region?.id);
  const lines = [
    "name,email,region,consented_at",
    ...rows.map((row) =>
      [
        cell(row.name),
        cell(row.email),
        cell(row.regionName ?? ""),
        cell(row.consentedAt ? row.consentedAt.toISOString() : ""),
      ].join(","),
    ),
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eleve-consent-${slug || "all"}.csv"`,
    },
  });
}
