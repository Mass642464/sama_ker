import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export default function NotFound() {
  return (
    <PageShell>
      <section className="grid min-h-[55vh] place-items-center px-5 py-16 text-center" aria-labelledby="not-found-title">
        <div className="max-w-lg">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#52655b]">Erreur 404</p>
          <h1 id="not-found-title" className="mt-3 text-3xl font-semibold tracking-tight text-[#174c38]">Cette page est introuvable.</h1>
          <p className="mt-3 text-sm leading-6 text-[#263238]">Le lien a peut-être changé ou la page n’existe plus.</p>
          <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#174c38] px-5 text-sm font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#a17229]">Retour à l’accueil</Link>
        </div>
      </section>
    </PageShell>
  );
}
