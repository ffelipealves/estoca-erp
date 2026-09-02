import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { SessionGate } from "@/components/session/SessionGate";
import { AuthProvider } from "@/context/AuthProvider";
import { SessionProvider } from "@/context/SessionProvider";

import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Estoca — ERP de estoque",
  description: "Demonstração interativa de gestão de estoque.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}
      lang="pt-BR"
    >
      <body>
        <SessionProvider>
          <SessionGate>
            <AuthProvider>{children}</AuthProvider>
          </SessionGate>
        </SessionProvider>
      </body>
    </html>
  );
}
