import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Clock3, Globe2, Video } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Votre projet depuis l’étranger", description: "Un accompagnement foncier à distance, adapté aux personnes de la diaspora sénégalaise." };
const steps = ["Échange initial et compréhension de votre projet", "Sélection de biens et informations disponibles", "Échange à distance et organisation d’une visite", "Orientation vers les vérifications et démarches adaptées"];
export default function DiasporaPage() {
  const highlights = [
    { icon: Globe2, title: "À votre rythme", text: "Échanges organisés selon vos disponibilités." },
    { icon: Video, title: "À distance", text: "Possibilité de rendez-vous en visioconférence." },
    { icon: Clock3, title: "Des étapes claires", text: "Un suivi adapté au décalage horaire." },
  ];

  return <PageShell>
    <section className="relative overflow-hidden bg-[#174c38] py-12 text-white sm:py-20">
      <div className="absolute -right-20 -top-20 size-80 rounded-full border border-white/10"/>
      <div className="container relative">
        <div className="grid gap-10 md:grid-cols-[1.1fr_.9fr] md:items-center">
          <div>
            <span className="eyebrow text-[#a6c8ad]">Là-bas, ici, ensemble</span>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">Votre projet au Sénégal, où que vous soyez.</h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/75">Un parcours à distance expliqué pas à pas, des échanges selon votre fuseau horaire et une équipe qui reste à vos côtés.</p>
            <Link href="/contact?origine=diaspora" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#a6c8ad] px-6 py-4 text-sm font-bold text-[#174c38]">Parler de mon projet <ArrowRight size={16}/></Link>
          </div>
          <figure className="relative h-[300px] overflow-hidden rounded-[26px] border border-white/15 bg-[#174c38] shadow-2xl sm:h-[400px]">
            <Image
              src="/images/diaspora.jpg"
              alt="Illustration numérique d’un globe relié par des réseaux, utilisée pour évoquer les échanges à distance"
              fill
              preload
              sizes="(max-width: 768px) 100vw, 45vw"
              className="object-cover object-[center_58%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#101812]/80 via-transparent to-[#101812]/10"/>
          </figure>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {highlights.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.06] p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#a6c8ad]"><Icon size={18}/></span><div><h2 className="text-sm font-bold">{title}</h2><p className="mt-1 text-xs text-white/65">{text}</p></div></div>)}
        </div>
      </div>
    </section>
    <section className="container grid gap-12 py-16 md:grid-cols-[.8fr_1.2fr]"><div><span className="eyebrow">Comment ça se passe ?</span><h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#174c38]">Des repères, à chaque étape.</h2><p className="mt-4 text-sm leading-6 text-[#56605a]">Nous commençons par comprendre votre besoin, puis nous convenons ensemble des prochaines étapes. Aucune décision ne doit être prise dans la précipitation.</p><p className="mt-5 flex items-start gap-2 text-xs leading-5 text-[#56605a]"><Check size={14} className="mt-0.5 shrink-0 text-[#548365]"/>Une checklist documentaire pourra être définie avec votre conseiller selon la nature du projet.</p></div><ol className="space-y-3">{steps.map((step, index) => <li key={step} className="flex gap-4 rounded-xl border border-[#e7e0d4] bg-white p-5"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#edf4ee] text-xs font-bold text-[#3d7759]">0{index + 1}</span><span className="pt-1 text-sm font-semibold leading-5 text-[#324a3e]">{step}</span></li>)}</ol></section>
    <section className="container pb-16"><div className="rounded-2xl bg-[#f0f3ec] p-6 text-xs leading-6 text-[#65756b]"><strong className="text-[#174c38]">À noter :</strong> ce contenu est pédagogique et ne remplace pas un conseil juridique, cadastral, fiscal ou professionnel. Les procédures peuvent varier selon la situation et doivent être confirmées auprès des interlocuteurs compétents.</div></section>
  </PageShell>;
}
