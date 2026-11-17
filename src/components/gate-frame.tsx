"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AgeGate } from "@/components/age-gate";

function isAuthPath(pathname: string) {
  return pathname === "/sign-in" || pathname.startsWith("/sign-in/") || pathname === "/sign-up" || pathname.startsWith("/sign-up/");
}

export function GateFrame({
  hasGate,
  header,
  footer,
  children,
}: {
  hasGate: boolean;
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() || "";
  if (isAuthPath(pathname)) return <div className="flex-1">{children}</div>;
  if (!hasGate) return <AgeGate />;
  return (
    <>
      {header}
      <div className="flex-1">{children}</div>
      {footer}
    </>
  );
}
