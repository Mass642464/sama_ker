import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, MapPin } from "lucide-react";
import { SamaKeurLogo } from "@/components/sama-keur-logo";

export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-[#174c38] text-white">
      <Image
        src="/images/footer.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-[center_55%]"
      />
      <div className="absolute inset-0 bg-[#174c38]/90" aria-hidden="true"/>
      <div className="container relative z-10 grid gap-12 py-16 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <Link href="/" className="inline-flex items-center rounded-xl bg-white px-4 py-3" aria-label="Sama Kër, la plateforme de GéoSpatia Consulting"><SamaKeurLogo loading="lazy"/></Link>
          <p className="mt-5 max-w-xs text-sm leading-6 text-white/60">La plateforme de GéoSpatia Consulting pour les projets fonciers, immobiliers et géospatiaux au Sénégal.</p>
        </div>
        <div><h3 className="mb-5 text-xs font-bold uppercase tracking-[.15em] text-[#e2c893]">Explorer</h3><ul className="space-y-3 text-sm text-white/70"><li><Link href="/terrains">Parcelles à vendre</Link></li><li><Link href="/immobilier">Biens immobiliers</Link></li><li><Link href="/carte">Explorer la carte</Link></li><li><Link href="/diaspora">Parcours diaspora</Link></li></ul></div>
        <div><h3 className="mb-5 text-xs font-bold uppercase tracking-[.15em] text-[#e2c893]">Le cabinet</h3><ul className="space-y-3 text-sm text-white/70"><li><Link href="/services">Nos services</Link></li><li><Link href="/a-propos">À propos</Link></li><li><Link href="/actualites">Conseils & actualités</Link></li><li><Link href="/faq">Questions fréquentes</Link></li></ul></div>
        <div><h3 className="mb-5 text-xs font-bold uppercase tracking-[.15em] text-[#e2c893]">Parlons de votre projet</h3><p className="text-sm leading-6 text-white/60">Une question sur une parcelle ou besoin d’un accompagnement ? Notre équipe est à votre écoute.</p><Link href="/contact" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white">Contacter l’équipe <ArrowUpRight size={15} /></Link><p className="mt-5 flex items-start gap-2 text-xs text-white/45"><MapPin size={14} className="mt-0.5 shrink-0" />Coordonnées du cabinet à renseigner</p></div>
      </div>
      <div className="relative z-10 border-t border-white/15"><div className="container flex flex-col justify-between gap-3 py-5 text-xs text-white/70 sm:flex-row"><span>© {new Date().getFullYear()} Sama Kër · GéoSpatia Consulting.</span><span>Informations de démonstration à confirmer avant publication.</span></div></div>
    </footer>
  );
}