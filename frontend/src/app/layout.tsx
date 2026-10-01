import type { Metadata, Viewport } from "next"
import { Archivo, Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"

import { SessionGate } from "@/components/session/SessionGate"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/context/AuthProvider"
import { SessionProvider } from "@/context/SessionProvider"

import "./globals.css"

/** One family for every voice: the width axis condenses figures and titles. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
})

// Legado: fontes das telas anteriores ao redesign. Saem com elas (etapa F10).
const legacyBodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
})

const legacyDisplayFont = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
})

const legacyMonoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "600"],
})

export const metadata: Metadata = {
  title: {
    default: "Estoca",
    template: "%s · Estoca",
  },
  description: "Mini-ERP de estoque em sandbox: seus dados são isolados e temporários.",
}

export const viewport: Viewport = {
  themeColor: "#23272b",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${legacyBodyFont.variable} ${legacyDisplayFont.variable} ${legacyMonoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SessionProvider>
          <SessionGate>
            <AuthProvider>{children}</AuthProvider>
          </SessionGate>
        </SessionProvider>
        <Toaster position="bottom-right" closeButton />
      </body>
    </html>
  )
}
