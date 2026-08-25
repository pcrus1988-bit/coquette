import type { Metadata } from "next"
import type { ReactNode } from "react"
import "../styles/globals.css"

export const metadata: Metadata = {
  title: "COQUETTE CONCEPT",
  description: "COQUETTE CONCEPT storefront rebuild",
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  )
}
