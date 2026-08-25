import type { Metadata } from "next"
import type { ReactNode } from "react"
import { SiteFooter } from "../components/site-footer"
import { SiteHeader } from "../components/site-header"
import "../styles/globals.css"

export const metadata: Metadata = {
  title: {
    default: "Γυναικεία Ρούχα | Coquette Concept",
    template: "%s | Coquette Concept",
  },
  description:
    "Coquette Concept — επιλεγμένα γυναικεία ρούχα, αξεσουάρ και designers από τη Σπάρτη.",
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="el">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
