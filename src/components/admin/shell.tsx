"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

const tabs = [
  ["/admin", "Home"],
  ["/admin/drops", "Drops"],
  ["/admin/run", "Run"],
  ["/admin/orders", "Orders"],
  ["/admin/more", "More"],
] as const;

type Toast = { id: number; tone: "ok" | "bad"; text: string; undo?: () => Promise<void> };

const ToastContext = createContext<(toast: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

function active(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(toast: Omit<Toast, "id">) {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 8000);
  }

  const nav = tabs.map(([href, label]) => (
    <Link
      key={href}
      href={href}
      className={`flex min-h-14 items-center justify-center px-2 text-center text-[10px] uppercase tracking-[0.14em] ${
        active(pathname, href) ? "bg-ink text-paper" : "text-ink"
      }`}
    >
      {label}
    </Link>
  ));

  return (
    <ToastContext.Provider value={push}>
      <div className="desk lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden print:hidden lg:block">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Desk</p>
          <nav className="mt-4 grid border border-ink">{nav}</nav>
        </aside>
        <div className="min-w-0 pb-28 lg:pb-6">{children}</div>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-ink bg-paper print:hidden lg:hidden">
          {nav}
        </nav>
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 border border-ink px-4 py-3 text-sm ${
                toast.tone === "bad" ? "bg-ink text-paper" : "bg-paper"
              }`}
            >
              <p>{toast.text}</p>
              {toast.undo ? (
                <button
                  type="button"
                  className={toast.tone === "bad" ? "secondary bg-paper" : "secondary"}
                  onClick={() => {
                    void toast.undo?.();
                    setToasts((current) => current.filter((item) => item.id !== toast.id));
                  }}
                >
                  Undo
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
