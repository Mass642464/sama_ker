import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, FileLock2, Flag, MapPin, Ruler, Share2, Video } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { CesiumMapPanel } from "@/components/cesium-map-panel";
import { FavoriteButton } from "@/components/favorite-button";
import { PageShell } from "@/components/page-shell";
import { PropertyCard } from "@/components/property-card";
import { PropertyGallery } from "@/components/property-gallery";
import { PropertyShare } from "@/components/property-share";
import { propertyPath } from "@/lib/property-share";
import { getSiteUrl } from "@/lib/site-url";
import { getPublicProperties } from "@/lib/public-properties";

const statusHelp: Record<string, string> = {
  "Disponible": "Disponibilité annoncée à confirmer avec l’équipe.",
  "À louer": "Location annoncée ; conditions et disponibilité à confirmer.",
  "Réservé": "Une demande est en cours ; la disponibilité n’est pas garantie.",
  "Vendu": "Ce bien n’est plus disponible.",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const property = (await getPublicProperties()).find((item) => item.slug === slug);
  const path = property ? propertyPath(property) : "";
  const imagePath = property ? `/api/annonces/${property.category === "terrain" ? "terrains" : "immobilier"}/${encodeURIComponent(property.slug)}/image` : "";
  return property ? {
    title: `${property.title} — ${property.location}`,
    description: property.isDemo
      ? `Fiche de démonstration non vérifiée à ${property.location}. Référence fictive ${property.ref}.`
      : `${property.title} à ${property.location}. Référence ${property.ref}. Informations publiées par l’équipe Sama Kër.`,
    ...(property.isDemo ? { robots: { index: false, follow: false } } : {
      alternates: { canonical: path },
      openGraph: {
        type: "website", locale: "fr_SN", title: property.title,
        description: `${property.priceLabel} · ${property.location} · Réf. ${property.ref}. Informations à confirmer.`,
        url: path,
        images: [{ url: imagePath, width: 1200, height: 630, alt: `Présentation de ${property.title}` }],
      },
    }),
  } : { title: "Bien introuvable" };
}

export async function PropertyDetailPage({ params, category = "terrain" }: { params: Promise<{ slug: string }>; category?: "terrain" | "immobilier" }) {
  const { slug } = await params;
  const properties = await getPublicProperties();
  const property = properties.find((item) => item.slug === slug);
  if (!property || property.category !== category) notFound();
  const similar = properties.filter((item) => item.category === category && item.slug !== property.slug).slice(0, 2);
  const href = `/${property.category === "terrain" ? "terrains" : "immobilier"}/${property.slug}`;

  return <PageShell>
    <section className="container py-8 sm:py-12">
      <Link href={category === "terrain" ? "/terrains" : "/immobilier"} className="inline-flex items-center gap-2 text-xs font-semibold text-[#52655b]"><ArrowLeft size={15}/> Retour aux biens</Link>
      <p role="note" className="mt-5 rounded-xl border border-[#e8dfc8] bg-[#faf6e9] px-4 py-3 text-xs leading-5 text-[#775d34]">
        {property.isDemo ? "Fiche de démonstration : annonce, prix, localisation, surface et disponibilité sont fictifs et non vérifiés." : "Annonce publiée par l’équipe : informations à confirmer. La publication ne constitue pas une certification cadastrale ou juridique."}
      </p>
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
        <div className="min-w-0">
          <PropertyGallery key={property.slug} photos={property.photos} isDemo={property.isDemo} art={property.art}/>
          <div className="mt-7 rounded-2xl border border-[#e7e0d4] bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#174c38]">
              <span className="rounded-full bg-[#f5f1e8] px-3 py-1.5">{property.kind}</span>
              <span className="rounded-full bg-[#edf4ee] px-3 py-1.5">{property.status}</span>
              <span className="text-[#626d66]">Réf. {property.ref}</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#174c38] sm:text-4xl">{property.title}</h1>
            <p className="mt-3 flex items-start gap-2 text-sm text-[#52655b]"><MapPin size={16} className="mt-0.5 shrink-0"/>{property.location}</p>
            <div className="mt-6 grid gap-3 border-t border-[#eee8dc] pt-5 sm:grid-cols-3">
              <div><p className="text-xs text-[#626d66]">Prix indicatif</p><p className="mt-1 text-lg font-bold text-[#174c38]">{property.priceLabel}</p></div>
              <div><p className="text-xs text-[#626d66]">Superficie</p><p className="mt-1 flex items-center gap-1.5 font-semibold text-[#263238]"><Ruler size={15}/>{property.area} m²</p></div>
              <div><p className="text-xs text-[#626d66]">Type de transaction</p><p className="mt-1 font-semibold text-[#263238]">{property.status === "À louer" ? "Location annoncée" : "Non précisé"}</p></div>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#626d66]">{property.isDemo ? "Données fictives, non vérifiées." : statusHelp[property.status] ?? "Disponibilité à confirmer."}</p>
          </div>

          <section className="mt-6 rounded-2xl border border-[#e7e0d4] bg-white p-5 sm:p-7">
            <h2 className="text-xl font-semibold text-[#174c38]">Présentation du bien</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#52655b]">{property.description}</p>
            <h3 className="mt-6 text-base font-semibold text-[#174c38]">Caractéristiques annoncées</h3>
            {property.features.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{property.features.map((feature, index) => <li key={`${feature}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-[#52655b]"><Check size={16} className="mt-1 shrink-0 text-[#4c8551]"/>{feature}</li>)}</ul> : <p className="mt-3 text-sm text-[#626d66]">Aucune caractéristique renseignée.</p>}
          </section>

          <section className="mt-6 rounded-2xl border border-[#e7e0d4] bg-white p-5 sm:p-7">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-[#174c38]"><FileLock2 size={20}/> Documents et informations</h2>
            <p className="mt-4 text-sm leading-6 text-[#52655b]">Aucun document n’est publié dans cette fiche. Les justificatifs privés ne sont pas accessibles publiquement ; leur disponibilité est à confirmer auprès de l’équipe.</p>
            <p className="mt-3 text-xs leading-5 text-[#775d34]">Aucun contrôle documentaire indépendant ni certification juridique n’est indiqué pour cette annonce.</p>
          </section>

          <section className="mt-6 rounded-2xl border border-[#e7e0d4] bg-white p-5 sm:p-7">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-[#174c38]"><Video size={20}/> Vidéo de présentation</h2>
            <p className="mt-3 text-sm text-[#626d66]">Aucune vidéo publiée pour le moment.</p>
          </section>

          <section className="mt-6 rounded-2xl border border-[#e7e0d4] bg-white p-5 sm:p-7">
            <h2 className="text-xl font-semibold text-[#174c38]">Informations géographiques</h2>
            <p className="mt-3 text-sm leading-6 text-[#52655b]">Région : <strong>{property.region}</strong>. Les coordonnées exactes et les limites de parcelle ne sont pas publiées sur cette fiche.</p>
            <div className="mt-5"><CesiumMapPanel region={property.region} markers={property.coordinates ? [{ id: property.slug, title: property.title, detail: `${property.priceLabel} · ${property.status}`, href, lat: property.coordinates.lat, lng: property.coordinates.lng }] : []} heightClassName="h-[280px]" note={property.coordinates ? "Le repère indique une zone d’environ 1 km validée par l’équipe, pas l’emplacement exact du bien." : "Vue générale de la région : aucun repère n’indique l’emplacement du bien."}/></div>
          </section>
        </div>

        <aside aria-label="Contact et actions" className="space-y-4">
          <section className="rounded-2xl border border-[#e7e0d4] bg-white p-5">
            <h2 className="text-lg font-semibold text-[#174c38]">Votre projet avec Sama Kër</h2>
            <p className="mt-2 text-sm leading-6 text-[#52655b]">Agence ou vendeur : non renseigné. Coordonnées directes non disponibles.</p>
            <Link href={`/contact?visite=${encodeURIComponent(property.ref)}`} className="mt-5 flex min-h-11 items-center justify-center rounded-full bg-[#174c38] px-4 text-sm font-bold text-white">{property.isDemo ? "Voir l’aperçu de visite" : "Demander une visite"}</Link>
            <p className="mt-2 text-xs leading-5 text-[#626d66]">La date proposée ne constitue pas une réservation confirmée.</p>
            <div className="mt-4"><FavoriteButton slug={property.slug} isDemo={property.isDemo}/></div>
            {!property.isDemo && <>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Bonjour, je suis intéressé(e) par ${property.title} (${property.ref}) à ${property.location}. Pouvez-vous me renseigner ?`)}`} target="_blank" rel="noreferrer" className="mt-4 flex min-h-10 items-center justify-center gap-2 text-xs font-semibold text-[#174c38]"><Share2 size={14}/> Préparer un message WhatsApp</a>
              <Link href={`/contact?bien=${encodeURIComponent(property.ref)}&motif=signalement`} className="mt-2 flex min-h-10 items-center justify-center gap-2 text-xs font-semibold text-[#946447]"><Flag size={14}/> Signaler cette annonce</Link>
            </>}
          </section>
          {!property.isDemo && <PropertyShare property={{ slug: property.slug, category: property.category, title: property.title, ref: property.ref, location: property.location, priceLabel: property.priceLabel }} origin={getSiteUrl().origin}/>}
          <section aria-labelledby="contact-bien-title">
            <h2 id="contact-bien-title" className="mb-3 text-lg font-semibold text-[#174c38]">Contacter l’équipe</h2>
            {property.isDemo ? <div className="rounded-2xl border border-[#e7e0d4] bg-white p-5 text-sm leading-6 text-[#52655b]">Cette annonce est fictive : aucune demande liée à ce bien ne peut être envoyée depuis cette fiche. <Link href="/contact" className="font-semibold text-[#174c38] underline">Contacter l’équipe pour un autre projet</Link>.</div>
              : <ContactForm propertyReference={property.ref} initialSubject="property"/>}
          </section>
        </aside>
      </div>
      <section className="mt-8 rounded-2xl bg-[#f5f1e8] p-5 text-sm leading-6 text-[#52655b]">
        <h2 className="font-semibold text-[#174c38]">Informations complémentaires</h2>
        <p className="mt-2">Prix, caractéristiques et disponibilité sont à confirmer. Les informations géographiques ne constituent pas une délimitation officielle.</p>
      </section>
    </section>
    {similar.length > 0 && <section className="bg-white py-12"><div className="container"><h2 className="text-2xl font-semibold text-[#174c38]">D’autres biens à découvrir</h2><p className="mt-2 text-sm text-[#626d66]">Autres annonces de la même catégorie, sans comparaison géographique.</p><div className="mt-6 grid gap-5 md:grid-cols-2">{similar.map((item) => <PropertyCard key={item.slug} property={item}/>)}</div></div></section>}
  </PageShell>;
}

export default function TerrainDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  return PropertyDetailPage({ params, category: "terrain" });
}
