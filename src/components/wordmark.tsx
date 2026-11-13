import Image from "next/image";

export function Wordmark({
  variant = "black",
  size = 32,
  priority = false,
}: {
  variant?: "black" | "white";
  size?: number;
  priority?: boolean;
}) {
  const src = variant === "white" ? "/brand/wordmark-white.png" : "/brand/wordmark-black.png";
  const height = size;
  const width = Math.round(size * (1323 / 567));
  return (
    <Image
      src={src}
      alt="Élevé"
      width={width}
      height={height}
      priority={priority}
      style={{ height, width }}
    />
  );
}
