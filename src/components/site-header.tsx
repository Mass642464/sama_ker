import Link from "next/link";
import { ArrowUpRight, House, UserRound } from "lucide-react";

const links = [
  ["Parcel", "/terrains"], ["Immobilier", "/immobilier"], ["Services", "/services"], ["Carte", "/carte"],
] as const;

export function SiteHeader() {
  return (
    <header className="relative z-40 border-b border-[#e8e9e7] bg-white">
      <div className="container flex h-[72px] items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Sama Kër, la plateforme de GéoSpatia Consulting">
          <span className="grid size-10 place-items-center rounded-xl bg-[#e8eee5] text-[#315c3a]"><House size={19}/></span>
          <span className="flex flex-col leading-tight text-[#243b2a]"><strong className="text-[13px] tracking-wide sm:text-sm">Sama Kër</strong><span className="mt-1 text-[7px] font-semibold uppercase tracking-[.1em] text-[#747b76] sm:text-[8px]">par GéoSpatia</span></span>
        </Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation principale">
          {links.map(([label, href]) => <Link key={href} href={href} className="text-[13px] font-semibold text-[#56605a] transition hover:text-[#43884c]">{label}</Link>)}
          <Link href="/diaspora" className="text-[13px] font-semibold text-[#56605a] transition hover:text-[#43884c]">Diaspora</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/espace-client" aria-label="Mon espace" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#56605a] transition hover:text-[#43884c] sm:text-xs"><UserRound size={16}/><span className="hidden sm:inline">Mon espace</span></Link>
          <Link href="/contact" className="inline-flex items-center gap-2 rounded-full bg-[#111411] px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-[#43884c] sm:px-5 sm:text-xs">Nous contacter <ArrowUpRight size={14}/></Link>
        </div>
      </div>
    </header>
  );
}