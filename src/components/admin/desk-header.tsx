import Link from "next/link";

export function DeskHeader({
  title,
  back,
  detail,
}: {
  title: string;
  back?: string;
  detail?: string;
}) {
  return (
    <header className="mb-6">
      {back ? (
        <Link href={back} className="text-sm">
          Back
        </Link>
      ) : null}
      <h1 className={`${back ? "mt-2" : ""} font-serif text-5xl leading-none`}>{title}</h1>
      {detail ? <p className="mt-3 max-w-xl text-sm text-mute">{detail}</p> : null}
    </header>
  );
}
