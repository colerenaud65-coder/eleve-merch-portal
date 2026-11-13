import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-20">
      <h1 className="font-serif text-6xl leading-none">Not on the menu</h1>
      <Link href="/" className="btn mt-8">
        Home
      </Link>
    </main>
  );
}
