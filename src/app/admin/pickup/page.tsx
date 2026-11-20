import { redirect } from "next/navigation";

export default async function PickupRedirect({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; missing?: string }>;
}) {
  const { token, missing } = await searchParams;
  const query = new URLSearchParams();
  if (token) query.set("token", token);
  if (missing) query.set("missing", missing);
  redirect(`/admin/run?${query.toString()}`);
}
