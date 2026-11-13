import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";

import { AgeGate } from "@/components/age-gate";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { readGate } from "@/server/gate";

import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-eleve-serif",
});

const sans = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-eleve-sans",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Élevé Select",
    template: "%s · Élevé Select",
  },
  description: "Numbered collector boxes and 7 g jars, released at pop-ups. Access is personal.",
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const gate = await readGate();
  const body = (
    <body className={`${serif.variable} ${sans.variable} flex min-h-dvh flex-col font-sans antialiased`}>
      {gate ? (
        <>
          <Header gate={gate} />
          <div className="flex-1">{children}</div>
          <Footer />
        </>
      ) : (
        <AgeGate />
      )}
    </body>
  );

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <html lang="en" className="h-full">
        {body}
      </html>
    );
  }

  const { ClerkProvider } = await import("@clerk/nextjs");
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        {body}
      </html>
    </ClerkProvider>
  );
}
