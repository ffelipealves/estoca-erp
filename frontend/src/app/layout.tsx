import type { Metadata } from "next";

import { SessionGate } from "@/components/session/SessionGate";
import { AuthProvider } from "@/context/AuthProvider";
import { SessionProvider } from "@/context/SessionProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Estoca — ERP de estoque",
  description: "Demonstração interativa de gestão de estoque.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
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
