import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import { SamaKeurLogo } from "@/components/sama-keur-logo";
import { DataSaverToggle } from "@/components/data-saver";

const links = [
  ["Parcelles", "/terrains"], ["Immobilier", "/immobilier"], ["Services", "/services"], ["Carte", "/carte"],
] as const;

export function SiteHeader() {
  return (
    <header className="relative z-40 border-b border-[#e7e0d4] bg-white">
      <div className="container flex h-[72px] items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Sama Kër, la plateforme de GéoSpatia Consulting">
          <SamaKeurLogo/>
        </Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation principale">
          {links.map(([label, href]) => <Link key={href} href={href} className="text-[13px] font-semibold text-[#56605a] transition hover:text-[#24674d]">{label}</Link>)}
          <Link href="/diaspora" className="text-[13px] font-semibold text-[#56605a] transition hover:text-[#24674d]">Diaspora</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/espace-client" aria-label="Mon espace" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#56605a] transition hover:text-[#24674d] sm:text-xs"><UserRound size={16}/><span className="hidden sm:inline">Mon espace</span></Link>
          <Link href="/contact" className="inline-flex items-center gap-2 rounded-full bg-[#174c38] px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-[#103b2b] sm:px-5 sm:text-xs">Nous contacter <ArrowUpRight size={14}/></Link>
        </div>
      </div>
      <DataSaverToggle />
    </header>
  );
}