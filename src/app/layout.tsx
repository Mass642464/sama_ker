import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Sama Kër — Foncier, immobilier & territoires",
    template: "%s | Sama Kër",
  },
  description:
    "Terrains, immobilier et expertise géospatiale au Sénégal. Des informations claires, des parcelles localisées et un accompagnement humain.",
  openGraph: {
    title: "Sama Kër — Foncier, immobilier & territoires",
    description: "Terrains, immobilier et expertise géospatiale au Sénégal.",
    locale: "fr_SN",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
