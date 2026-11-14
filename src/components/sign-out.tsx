import { signOut } from "@/server/actions";

export async function SignOut({ clerk }: { clerk: boolean }) {
  if (clerk) {
    const { SignOutButton } = await import("@clerk/nextjs");
    return <SignOutButton signOutOptions={{ redirectUrl: "/" }} />;
  }
  return (
    <form action={signOut}>
      <button type="submit" className="secondary">
        Sign out
      </button>
    </form>
  );
}
