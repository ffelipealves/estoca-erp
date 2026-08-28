import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estoca — ERP de estoque",
  description: "Demonstração interativa de gestão de estoque.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
