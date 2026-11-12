"use client";

import Image from "next/image";
import { useState } from "react";
import { Copy, QrCode, Share2 } from "lucide-react";
import { propertyShareDetails } from "@/lib/property-share";
import type { Property } from "@/lib/properties";

type Props = {
  property: Pick<Property, "slug" | "category" | "title" | "ref" | "location" | "priceLabel">;
  origin: string;
};

export function PropertyShare({ property, origin }: Props) {
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const details = propertyShareDetails(property, origin);
  const imagePath = `/api/annonces/${property.category === "terrain" ? "terrains" : "immobilier"}/${encodeURIComponent(property.slug)}/image`;
  const local = ["localhost", "127.0.0.1"].includes(new URL(origin).hostname);

  async function copy() {
    try {
      await navigator.clipboard.writeText(details.url);
      setMessage("Lien copié.");
    } catch {
      setMessage("Impossible de copier automatiquement le lien. Sélectionnez et copiez l’adresse affichée.");
    }
  }

  async function share() {
    if (!navigator.share) {
      setMessage("Le partage natif n’est pas disponible sur cet appareil. Copiez le lien pour l’envoyer.");
      return;
    }
    try {
      await navigator.share({ title: property.title, text: `${property.title} · ${property.priceLabel} · ${property.location}`, url: details.url });
      setMessage("Partage ouvert sur votre appareil.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Le partage n’a pas pu être ouvert. Copiez le lien pour l’envoyer.");
    }
  }

  async function generateQr() {
    setBusy(true);
    setMessage("");
    try {
      const { toDataURL } = await import("qrcode");
      setQr(await toDataURL(details.url, { width: 320, margin: 4, errorCorrectionLevel: "M", color: { dark: "#174c38", light: "#ffffff" } }));
    } catch {
      setMessage("Le QR code n’a pas pu être généré. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return <section aria-labelledby="share-title" className="rounded-2xl border border-[#e7e0d4] bg-white p-5">
    <h2 id="share-title" className="flex items-center gap-2 text-lg font-semibold text-[#174c38]"><Share2 size={18} aria-hidden="true"/>Partager cette annonce</h2>
    <p className="mt-2 text-xs leading-5 text-[#52655b]">Prix et localisation sont indicatifs. L’image de présentation contient du texte, sans photo. Son aperçu dépend du service utilisé.</p>
    {local && <p role="note" className="mt-2 rounded-lg bg-[#faf6e9] p-3 text-xs text-[#775d34]">Ce lien local ne sera pas accessible depuis les autres appareils. Configurez un domaine public HTTPS avant partage.</p>}
    <div className="mt-4 grid grid-cols-2 gap-2">
      <a href={details.whatsapp} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#174c38] px-3 text-xs font-semibold text-white">WhatsApp</a>
      <a href={details.facebook} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#cbd9ce] px-3 text-xs font-semibold text-[#174c38]">Facebook</a>
      <button type="button" onClick={() => void share()} className="min-h-11 rounded-lg border border-[#cbd9ce] px-3 text-xs font-semibold text-[#174c38]">Partager / Messenger</button>
      <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-[#cbd9ce] px-3 text-xs font-semibold text-[#174c38]"><Copy size={14} aria-hidden="true"/>Copier le lien</button>
    </div>
    <label className="mt-4 block text-xs font-semibold text-[#52655b]">Lien direct<input readOnly value={details.url} onFocus={(event) => event.currentTarget.select()} className="mt-1 w-full rounded-lg border border-[#dddccf] px-3 py-2 text-xs font-normal text-[#263238]"/></label>
    <div className="mt-3 flex flex-wrap gap-3"><a href={imagePath} download={`sama-ker-${property.slug}.png`} className="inline-flex min-h-11 items-center text-xs font-semibold text-[#174c38] underline">Télécharger l’image de présentation</a><button type="button" disabled={busy} onClick={() => void generateQr()} className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[#174c38] underline disabled:opacity-60"><QrCode size={15} aria-hidden="true"/>{busy ? "Génération…" : qr ? "Actualiser le QR code" : "Afficher le QR code"}</button></div>
    {qr && <div className="mt-2"><Image src={qr} alt={`QR code du lien de l’annonce ${property.ref}`} width={200} height={200} unoptimized/><a href={qr} download={`sama-ker-${property.slug}-qr.png`} className="mt-2 inline-block text-xs font-semibold text-[#174c38] underline">Télécharger le QR code</a></div>}
    <p aria-live="polite" className="mt-2 text-xs leading-5 text-[#52655b]">{message}</p>
  </section>;
}
