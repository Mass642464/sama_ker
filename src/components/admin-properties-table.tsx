"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight, Copy, Download, Eye, MapPin, Pencil, Plus, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { adminApi, type AdminListing, type AdminListingPhoto, type ListingDraft } from "@/lib/admin-api";
import { CesiumMapPanel, type MapMarker } from "@/components/cesium-map-panel";
import { useAdminSession } from "@/components/admin-session";

type LocalPhoto = {
  file: File;
  previewUrl: string;
  type: string;
  alt: string;
  credit: string;
};

const blankDraft: ListingDraft = {
  ref: "",
  title: "",
  category: "immobilier",
  region: "",
  location: "",
  price: 0,
  pricePeriod: "total",
  area: 0,
  kind: "",
  status: "Disponible",
  description: "",
  features: [],
  publicationStatus: "draft",
  latitude: null,
  longitude: null,
  photos: [],
};

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv(properties: AdminListing[]) {
  const rows = [
    ["Référence", "Titre", "Catégorie", "Région", "Localisation", "Prix", "Période", "Surface m²", "Type", "Statut", "Publication"],
    ...properties.map((property) => [
      property.ref, property.title, property.category, property.region, property.location,
      property.price, property.pricePeriod, property.area, property.kind, property.status, property.publicationStatus,
    ]),
  ];
  const file = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "annonces-sama-ker.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function ListingThumbnail({ photo }: { photo: AdminListingPhoto | undefined }) {
  const [unavailable, setUnavailable] = useState(false);
  return <div className="relative h-40 shrink-0 bg-[#e8eee5] sm:h-auto sm:min-h-44 sm:w-40">
    {photo && !unavailable
      ? <Image src={photo.previewSrc ?? photo.src} alt={photo.alt} fill sizes="(max-width: 640px) 100vw, 160px" unoptimized onError={() => setUnavailable(true)} className="object-cover"/>
      : <div className="grid h-full min-h-40 place-items-center p-3 text-center text-xs text-[#617169]">{photo ? "Photo indisponible" : "Aucune photo"}</div>}
  </div>;
}

function ListingForm({
  listing,
  duplicate,
  onClose,
  onSaved,
}: {
  listing: AdminListing | null;
  duplicate?: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<ListingDraft>(() => listing ? {
    ref: duplicate ? "" : listing.ref,
    title: listing.title,
    category: listing.category,
    region: listing.region,
    location: listing.locationLabel,
    price: listing.price,
    pricePeriod: listing.pricePeriod,
    area: listing.area,
    kind: listing.kind,
    status: listing.status,
    description: listing.description,
    features: listing.features,
    publicationStatus: duplicate ? "draft" : listing.publicationStatus === "published" ? "review" : listing.publicationStatus,
    latitude: listing.coordinates?.lat ?? null,
    longitude: listing.coordinates?.lng ?? null,
    photos: duplicate ? [] : listing.photos ?? [],
  } : blankDraft);
  const [featureText, setFeatureText] = useState(listing?.features.join("\n") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([]);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
  }, []);

  function update<K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function removePreview(url?: string) {
    if (!url || !previewUrls.current.delete(url)) return;
    URL.revokeObjectURL(url);
  }

  function addLocalPhotos(files: FileList | null) {
    if (!files) return;
    const accepted: LocalPhoto[] = [];
    let selectionError = "";
    const allowedTypes: Record<string, string> = {
      "image/jpeg": "image/jpeg",
      "image/png": "image/png",
      "image/webp": "image/webp",
    };
    const extensions: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    for (const file of Array.from(files)) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      const type = allowedTypes[file.type.toLowerCase()] ?? extensions[extension];
      if (!type) {
        selectionError = "Choisissez uniquement des photos JPG, PNG ou WebP.";
        continue;
      }
      if (file.size === 0 || file.size >= 10 * 1024 * 1024) {
        selectionError = "Chaque photo doit faire entre 1 octet et moins de 10 Mo.";
        continue;
      }
      accepted.push({
        file,
        previewUrl: URL.createObjectURL(file),
        type,
        alt: "",
        credit: "Fournie par le déposant",
      });
    }

    const available = Math.max(0, 12 - draft.photos.length - localPhotos.length);
    for (const photo of accepted.slice(available)) removePreview(photo.previewUrl);
    const additions = accepted.slice(0, available);
    setLocalPhotos((current) => [...current, ...additions]);
    if (accepted.length > available) selectionError = "Une annonce peut contenir au maximum 12 photos.";
    setError(selectionError);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 2 || busy) return;
    const invalid = Array.from(event.currentTarget.elements).find((element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) && !element.checkValidity());
    if (invalid) {
      const section = invalid.closest<HTMLElement>("[data-form-step]");
      setStep(Number(section?.dataset.formStep ?? 0));
      setError("Vérifiez les champs obligatoires de cette étape avant d’enregistrer.");
      window.setTimeout(() => { invalid.focus(); invalid.reportValidity(); }, 0);
      return;
    }
    if (draft.description.trim().length < 20) {
      setStep(1);
      setError("La description doit contenir au moins 20 caractères utiles.");
      return;
    }
    const features = featureText.split("\n").map((item) => item.trim()).filter(Boolean);
    if (features.length > 12 || features.some((feature) => feature.length > 120)) {
      setStep(1);
      setError("Saisissez au maximum 12 caractéristiques, de 120 caractères chacune.");
      return;
    }
    if ((draft.latitude === null) !== (draft.longitude === null)) {
      setStep(1);
      setError("Renseignez les deux coordonnées approximatives ou laissez les deux champs vides.");
      return;
    }
    setBusy(true);
    setError("");
    const uploadedPhotos: AdminListingPhoto[] = [];
    let listingSaved = false;
    try {
      for (const photo of localPhotos) {
        const uploaded = await adminApi<{ src: string; previewSrc: string }>("/api/admin/listing-images", {
          method: "POST",
          headers: { "Content-Type": photo.type },
          body: photo.file,
        });
        uploadedPhotos.push({
          src: uploaded.src,
          previewSrc: photo.previewUrl || uploaded.previewSrc,
          alt: photo.alt,
          credit: photo.credit,
          sourceUrl: "",
        });
      }
      const payload: ListingDraft = {
        ...draft,
        price: Number(draft.price),
        area: Number(draft.area),
        features,
        photos: [...draft.photos, ...uploadedPhotos],
      };
      await adminApi(`/api/admin/properties${listing && !duplicate ? `/${listing.id}` : ""}`, {
        method: listing && !duplicate ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      listingSaved = true;
      update("photos", payload.photos);
      setLocalPhotos([]);
      await onSaved();
      onClose();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "L’annonce n’a pas pu être enregistrée.";
      let cleanupFailed = false;
      if (!listingSaved) {
        for (const photo of uploadedPhotos) {
          try {
            await adminApi(`/api/admin/listing-images?src=${encodeURIComponent(photo.src)}`, { method: "DELETE" });
          } catch {
            cleanupFailed = true;
          }
        }
      }
      setError(cleanupFailed
        ? `${message} Une photo importée n’a pas pu être nettoyée ; contactez un administrateur.`
        : message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#17251bcc] p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="listing-form-title" className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#3d7759]">Catalogue</p><h2 id="listing-form-title" className="mt-1 text-xl font-semibold text-[#18371d]">{duplicate ? "Dupliquer l’annonce" : listing ? "Modifier l’annonce" : "Ajouter une annonce"}</h2></div><button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-[#617169] hover:bg-[#f1f5f0]"><X size={18}/></button></div>
      <p className="mt-4 text-xs font-semibold text-[#52655b]">Étape {step + 1} sur 3 · {["Informations du bien", "Description et position", "Photos et enregistrement"][step]}</p>
      {duplicate && <p className="mt-2 text-xs leading-5 text-[#52655b]">Nouvelle référence obligatoire. Les photos et documents ne sont pas copiés ; vérifiez les informations avant validation.</p>}
      <form onSubmit={submit} onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing && event.target instanceof HTMLInputElement && event.target.type !== "submit") {
          event.preventDefault();
        }
      }} noValidate className="mt-5 grid gap-3 sm:grid-cols-2">
        <div data-form-step="0" className={step === 0 ? "grid gap-3 sm:col-span-2 sm:grid-cols-2" : "hidden"}>
        <label className="text-xs font-semibold text-[#52655b]">Référence<input required minLength={2} maxLength={40} pattern=".*\S.*" value={draft.ref} onChange={(event) => update("ref", event.target.value)} className="admin-field"/></label>
        <label className="text-xs font-semibold text-[#52655b]">Catégorie<select value={draft.category} onChange={(event) => update("category", event.target.value as ListingDraft["category"])} className="admin-field"><option value="immobilier">Immobilier</option><option value="terrain">Terrain</option></select></label>
        <label className="text-xs font-semibold text-[#52655b] sm:col-span-2">Titre<input required minLength={5} maxLength={140} pattern=".*\S.*" value={draft.title} onChange={(event) => update("title", event.target.value)} className="admin-field"/></label>
        <label className="text-xs font-semibold text-[#52655b]">Région<input required minLength={2} maxLength={80} pattern=".*\S.*" value={draft.region} onChange={(event) => update("region", event.target.value)} className="admin-field"/></label>
        <label className="text-xs font-semibold text-[#52655b]">Localisation générale<input required minLength={2} maxLength={100} pattern=".*\S.*" value={draft.location} onChange={(event) => update("location", event.target.value)} className="admin-field"/></label>
        <label className="text-xs font-semibold text-[#52655b]">Prix (FCFA)<input required type="number" min="1" max="9007199254740991" step="1" value={draft.price} onChange={(event) => update("price", Number(event.target.value))} className="admin-field"/></label>
        <label className="text-xs font-semibold text-[#52655b]">Période du prix<select value={draft.pricePeriod} onChange={(event) => update("pricePeriod", event.target.value as ListingDraft["pricePeriod"])} className="admin-field"><option value="total">Prix total</option><option value="monthly">Par mois</option></select></label>
        <label className="text-xs font-semibold text-[#52655b]">Surface (m²)<input required type="number" min="0.01" max="99999999" step="0.01" value={draft.area} onChange={(event) => update("area", Number(event.target.value))} className="admin-field"/></label>
        <label className="text-xs font-semibold text-[#52655b]">Type de bien<input required minLength={2} maxLength={80} pattern=".*\S.*" value={draft.kind} onChange={(event) => update("kind", event.target.value)} className="admin-field"/></label>
        <label className="text-xs font-semibold text-[#52655b]">Disponibilité<select value={draft.status} onChange={(event) => update("status", event.target.value)} className="admin-field"><option>Disponible</option><option>À louer</option><option>Réservé</option><option>Vendu</option></select></label>
        <label className="text-xs font-semibold text-[#52655b]">Publication<select value={draft.publicationStatus} onChange={(event) => update("publicationStatus", event.target.value)} className="admin-field"><option value="draft">Brouillon</option><option value="review">À vérifier</option><option value="archived">Archivé</option></select></label>
        </div>
        <div data-form-step="1" className={step === 1 ? "grid gap-3 sm:col-span-2 sm:grid-cols-2" : "hidden"}>
        <label className="text-xs font-semibold text-[#52655b] sm:col-span-2">Description<textarea required minLength={20} maxLength={2000} rows={4} value={draft.description} onChange={(event) => update("description", event.target.value)} className="admin-field"/></label>
        <label className="text-xs font-semibold text-[#52655b] sm:col-span-2">Caractéristiques (une par ligne)<textarea rows={3} maxLength={1500} value={featureText} onChange={(event) => setFeatureText(event.target.value)} className="admin-field"/></label>
        <fieldset className="sm:col-span-2 grid gap-3 rounded-xl border border-[#e5eae5] p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-semibold text-[#52655b]">Position approximative sur la carte (facultative)</legend>
          <label className="text-xs font-semibold text-[#52655b]">Latitude<input type="number" inputMode="decimal" min="12" max="16.8" step="0.01" value={draft.latitude ?? ""} onChange={(event) => update("latitude", event.target.value === "" ? null : Number(event.target.value))} className="admin-field" placeholder="14.79"/></label>
          <label className="text-xs font-semibold text-[#52655b]">Longitude<input type="number" inputMode="decimal" min="-17.8" max="-11.3" step="0.01" value={draft.longitude ?? ""} onChange={(event) => update("longitude", event.target.value === "" ? null : Number(event.target.value))} className="admin-field" placeholder="-16.93"/></label>
          <p className="sm:col-span-2 text-xs leading-4 text-[#56605a]">Indiquez le centre d’une zone d’environ 1 km, pas l’emplacement exact : les valeurs sont arrondies à 0,01° (≈ 1 km) et publiées après validation. Renseignez les deux champs ou aucun. Ne saisissez jamais les coordonnées précises d’une parcelle.</p>
        </fieldset>
        </div>
        <div data-form-step="2" className={step === 2 ? "sm:col-span-2" : "hidden"}>
        <fieldset className="sm:col-span-2 grid gap-3 rounded-xl border border-[#e5eae5] p-3">
          <legend className="px-1 text-xs font-semibold text-[#52655b]">Photos du bien ({draft.photos.length + localPhotos.length}/12)</legend>
          <p className="text-xs leading-4 text-[#56605a]">Importez des photos depuis votre appareil, sous différents angles. Elles restent privées jusqu’à l’approbation de l’annonce. JPG, PNG ou WebP, moins de 10 Mo par photo.</p>
          <label htmlFor="listing-local-photos" className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#dce6dc] px-3 py-2 text-xs font-semibold text-[#32743d] hover:bg-[#f5f8f3]">
            <Upload size={14}/> Choisir des photos
          </label>
          <input id="listing-local-photos" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple disabled={busy || draft.photos.length + localPhotos.length >= 12} onChange={(event) => { addLocalPhotos(event.target.files); event.currentTarget.value = ""; }} className="sr-only"/>
          {(draft.photos.length > 0 || localPhotos.length > 0) && <div className="grid gap-3 sm:grid-cols-2">
            {draft.photos.map((photo, index) => <div key={`${photo.src}-${index}`} className="grid gap-2 rounded-lg border border-[#edf0ed] p-2">
              <Image src={photo.previewSrc ?? photo.src} alt={photo.alt} width={480} height={300} unoptimized className="h-36 w-full rounded-md bg-[#f4f3ec] object-cover"/>
              <label className="text-xs font-semibold text-[#52655b]">Texte alternatif<input required minLength={10} maxLength={240} pattern=".*\S.*" value={photo.alt} onChange={(event) => update("photos", draft.photos.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item))} className="admin-field"/></label>
              <label className="text-xs font-semibold text-[#52655b]">Crédit<input required minLength={2} maxLength={160} pattern=".*\S.*" value={photo.credit} onChange={(event) => update("photos", draft.photos.map((item, itemIndex) => itemIndex === index ? { ...item, credit: event.target.value } : item))} className="admin-field"/></label>
              <label className="text-xs font-semibold text-[#52655b]">URL source HTTPS (facultative)<input type="url" pattern="https://.+" title="Saisissez une URL commençant par https://." value={photo.sourceUrl} onChange={(event) => update("photos", draft.photos.map((item, itemIndex) => itemIndex === index ? { ...item, sourceUrl: event.target.value } : item))} className="admin-field"/></label>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={index === 0} onClick={() => { const photos = [...draft.photos]; [photos[index - 1], photos[index]] = [photos[index], photos[index - 1]]; update("photos", photos); }} aria-label={`Avancer la photo ${index + 1}`} className="text-[#32743d] disabled:opacity-40"><ArrowUp size={16}/></button>
                <button type="button" disabled={index === draft.photos.length - 1} onClick={() => { const photos = [...draft.photos]; [photos[index + 1], photos[index]] = [photos[index], photos[index + 1]]; update("photos", photos); }} aria-label={`Reculer la photo ${index + 1}`} className="text-[#32743d] disabled:opacity-40"><ArrowDown size={16}/></button>
                <button type="button" onClick={() => { removePreview(photo.previewSrc); update("photos", draft.photos.filter((_, itemIndex) => itemIndex !== index)); }} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-[#8d3c32]"><Trash2 size={12}/> Retirer la photo</button>
              </div>
            </div>)}
            {localPhotos.map((photo, index) => <div key={photo.previewUrl} className="grid gap-2 rounded-lg border border-[#edf0ed] p-2">
              <Image src={photo.previewUrl} alt={photo.alt} width={480} height={300} unoptimized className="h-36 w-full rounded-md bg-[#f4f3ec] object-cover"/>
              <label className="text-xs font-semibold text-[#52655b]">Texte alternatif<input required minLength={10} maxLength={240} pattern=".*\S.*" value={photo.alt} onChange={(event) => setLocalPhotos((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item))} className="admin-field"/></label>
              <label className="text-xs font-semibold text-[#52655b]">Crédit<input required minLength={2} maxLength={160} pattern=".*\S.*" value={photo.credit} onChange={(event) => setLocalPhotos((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, credit: event.target.value } : item))} className="admin-field"/></label>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={index === 0} onClick={() => setLocalPhotos((current) => { const photos = [...current]; [photos[index - 1], photos[index]] = [photos[index], photos[index - 1]]; return photos; })} aria-label={`Avancer la nouvelle photo ${index + 1}`} className="text-[#32743d] disabled:opacity-40"><ArrowUp size={16}/></button>
                <button type="button" disabled={index === localPhotos.length - 1} onClick={() => setLocalPhotos((current) => { const photos = [...current]; [photos[index + 1], photos[index]] = [photos[index], photos[index + 1]]; return photos; })} aria-label={`Reculer la nouvelle photo ${index + 1}`} className="text-[#32743d] disabled:opacity-40"><ArrowDown size={16}/></button>
                <button type="button" onClick={() => { removePreview(photo.previewUrl); setLocalPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-[#8d3c32]"><Trash2 size={12}/> Retirer la photo</button>
              </div>
            </div>)}
          </div>}
        </fieldset>
        </div>
        <p className="sm:col-span-2 text-xs leading-4 text-[#56605a]">Toute modification retire l’annonce publiée et nécessite une nouvelle validation par un responsable distinct. N’indiquez que des informations et visuels confirmés et autorisés ; la publication ne vaut pas vérification juridique ou foncière.</p>
        {error && <p role="alert" className="sm:col-span-2 rounded-lg bg-[#fbf0ee] p-3 text-xs text-[#8d3c32]">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button type="button" onClick={onClose} className="rounded-lg border border-[#e5eae5] px-4 py-2 text-xs font-semibold text-[#52655b]">Annuler</button>{step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg border border-[#e5eae5] px-4 py-2 text-xs font-semibold text-[#52655b]">Précédent</button>}{step < 2 ? <button type="button" onClick={() => setStep(step + 1)} className="rounded-lg bg-[#32743d] px-4 py-2 text-xs font-bold text-white">Suivant</button> : <button type="submit" disabled={busy} className="rounded-lg bg-[#32743d] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{busy ? "Enregistrement…" : listing && !duplicate ? "Enregistrer" : "Créer l’annonce"}</button>}</div>
      </form>
    </section>
  </div>;
}

function ReviewForm({ listing, onClose, onSaved }: { listing: AdminListing; onClose: () => void; onSaved: () => Promise<void> }) {
  const [fieldsConfirmed, setFieldsConfirmed] = useState(false);
  const [mediaConfirmed, setMediaConfirmed] = useState(false);
  const [publicContentConfirmed, setPublicContentConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminApi(`/api/admin/properties/${listing.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ revision: listing.reviewRevision, fieldsConfirmed, mediaConfirmed, publicContentConfirmed }),
      });
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La validation a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#17251bcc] p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="review-title" className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><h2 id="review-title" className="text-xl font-semibold text-[#18371d]">Contrôler l’annonce {listing.ref}</h2><button type="button" onClick={onClose} aria-label="Fermer" className="p-2"><X size={18}/></button></div>
      <p className="mt-3 text-xs leading-5 text-[#52655b]">Réservé aux responsables désignés n’ayant jamais préparé ou modifié cette annonce. Contrôlez les justificatifs dans un espace privé. La validation ne constitue pas une garantie juridique ou foncière.</p>
      <dl className="mt-4 grid gap-2 rounded-xl bg-[#f7f5ee] p-4 text-xs leading-5 text-[#344b3f] sm:grid-cols-2">
        <div><dt className="font-bold">Titre et catégorie</dt><dd>{listing.title} · {listing.category}</dd></div>
        <div><dt className="font-bold">Type</dt><dd>{listing.kind}</dd></div>
        <div><dt className="font-bold">Localisation générale</dt><dd>{listing.location}</dd></div>
        <div><dt className="font-bold">Position approximative sur la carte</dt><dd>{listing.coordinates ? `${listing.coordinates.lat.toFixed(2)}, ${listing.coordinates.lng.toFixed(2)} (zone d’environ 1 km, publiée sur la carte)` : "Aucune : le bien ne sera pas repéré sur la carte"}</dd></div>
        <div><dt className="font-bold">Prix et surface</dt><dd>{listing.priceLabel} · {listing.area} m²</dd></div>
        <div><dt className="font-bold">Disponibilité</dt><dd>{listing.status}</dd></div>
        <div className="sm:col-span-2"><dt className="font-bold">Description</dt><dd className="whitespace-pre-wrap">{listing.description}</dd></div>
        <div className="sm:col-span-2"><dt className="font-bold">Caractéristiques</dt><dd>{listing.features.join(" · ") || "Aucune"}</dd></div>
        <div className="sm:col-span-2"><dt className="font-bold">Médias à vérifier</dt><dd>{listing.photos?.length ? <div className="grid gap-3 sm:grid-cols-2">{listing.photos.map((photo) => <a key={photo.src} href={photo.previewSrc ?? photo.src} target="_blank" rel="noopener noreferrer" className="grid gap-2 rounded-lg border border-[#e5eae5] p-2"><Image src={photo.previewSrc ?? photo.src} alt={photo.alt} width={480} height={300} unoptimized className="h-36 w-full rounded-md bg-[#f4f3ec] object-cover"/><span className="text-xs">{photo.alt} · Crédit : {photo.credit}</span></a>)}</div> : "Aucune photo : validation impossible."}</dd></div>
      </dl>
      <form onSubmit={approve} className="mt-4 grid gap-3 text-xs text-[#344b3f]">
        <label className="flex gap-2"><input type="checkbox" required checked={fieldsConfirmed} onChange={(event) => setFieldsConfirmed(event.target.checked)}/>Les informations et leur actualité ont été contrôlées auprès de sources autorisées.</label>
        <label className="flex gap-2"><input type="checkbox" required checked={mediaConfirmed} onChange={(event) => setMediaConfirmed(event.target.checked)}/>Chaque photo représente le bien et ses droits de publication et crédits sont confirmés.</label>
        <label className="flex gap-2"><input type="checkbox" required checked={publicContentConfirmed} onChange={(event) => setPublicContentConfirmed(event.target.checked)}/>Le contenu public ne contient ni données personnelles ni documents ou coordonnées précis non autorisés ; la position approximative affichée correspond bien à la zone du bien.</label>
        {listing.reviewRevision === null && <p role="alert">Cette annonce doit d’abord être enregistrée à nouveau et mise « À vérifier ».</p>}
        {error && <p role="alert" className="rounded-lg bg-[#fbf0ee] p-3 text-[#8d3c32]">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-[#e5eae5] px-4 py-2">Annuler</button><button disabled={busy || listing.reviewRevision === null || !listing.photos?.length} className="rounded-lg bg-[#32743d] px-4 py-2 font-bold text-white disabled:opacity-60">{busy ? "Validation…" : "Valider et publier"}</button></div>
      </form>
    </section>
  </div>;
}

export function AdminPropertiesTable({
  properties: initialProperties,
  onPropertiesChange,
}: {
  properties: AdminListing[];
  onPropertiesChange: (properties: AdminListing[]) => void;
}) {
  const [properties, setProperties] = useState<AdminListing[]>(initialProperties);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous les statuts");
  const [publicationFilter, setPublicationFilter] = useState("Toutes les publications");
  const [categoryFilter, setCategoryFilter] = useState("Toutes les catégories");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminListing | null>(null);
  const [reviewing, setReviewing] = useState<AdminListing | null>(null);
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState<AdminListing | null>(null);
  const [busyId, setBusyId] = useState("");
  const [focus, setFocus] = useState<{ id: string | null; nonce: number }>({ id: null, nonce: 0 });
  const { can } = useAdminSession();
  const canWrite = can("properties:write");
  const canReview = can("properties:review");
  const canReadFiles = can("files:read");

  async function refresh() {
    const result = await adminApi<AdminListing[]>("/api/admin/properties");
    setProperties(result);
    onPropertiesChange(result);
    setError("");
  }

  const filtered = useMemo(() => properties.filter((property) => {
    const matchesQuery = `${property.title} ${property.ref} ${property.location}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "Tous les statuts" || property.status === statusFilter;
    const matchesPublication = publicationFilter === "Toutes les publications" || property.publicationStatus === publicationFilter;
    const matchesCategory = categoryFilter === "Toutes les catégories" || property.category === categoryFilter;
    return matchesQuery && matchesStatus && matchesPublication && matchesCategory;
  }), [properties, query, statusFilter, publicationFilter, categoryFilter]);

  const markers = useMemo<MapMarker[]>(() => filtered.flatMap((property) =>
    property.publicationStatus === "published" && property.coordinates ? [{
      id: property.id, title: property.title, detail: `${property.priceLabel} · ${property.status}`,
      href: `/${property.category === "terrain" ? "terrains" : "immobilier"}/${property.slug}`,
      lat: property.coordinates.lat, lng: property.coordinates.lng,
    }] : [],
  ), [filtered]);

  async function updateStatus(property: AdminListing, availabilityStatus: string) {
    setBusyId(property.id);
    setError("");
    try {
      await adminApi(`/api/admin/properties/${property.id}`, { method: "PATCH", body: JSON.stringify({ availabilityStatus }) });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le statut n’a pas pu être modifié.");
    } finally {
      setBusyId("");
    }
  }

  return <>
    <div className="flex flex-wrap gap-3 rounded-2xl border border-[#e6ebe6] bg-white p-4">
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg bg-[#f6f8f5] px-3 sm:min-w-48"><Search size={14} className="shrink-0 text-[#56605a]"/><span className="sr-only">Rechercher une annonce</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un bien, une référence…" className="w-full bg-transparent text-xs outline-none placeholder:text-[#56605a]"/></label>
      <div className="flex flex-wrap gap-2">
        <label className="flex h-10 items-center rounded-lg border border-[#e5eae5] px-3 text-xs text-[#52655b]"><select aria-label="Filtrer par catégorie" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="bg-transparent font-semibold outline-none"><option>Toutes les catégories</option><option value="terrain">Terrains</option><option value="immobilier">Immobilier</option></select></label>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e5eae5] px-3 text-xs text-[#67776f]"><SlidersHorizontal size={13}/><select aria-label="Filtrer par disponibilité" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent font-semibold outline-none"><option>Tous les statuts</option><option>Disponible</option><option>À louer</option><option>Réservé</option><option>Vendu</option></select></label>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e5eae5] px-3 text-xs text-[#67776f]"><select aria-label="Filtrer par publication" value={publicationFilter} onChange={(event) => setPublicationFilter(event.target.value)} className="bg-transparent font-semibold outline-none"><option value="Toutes les publications">Toutes les publications</option><option value="draft">Brouillon</option><option value="review">À vérifier</option><option value="published">Publié</option><option value="archived">Archivé</option></select></label>
        <button type="button" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0} className="flex h-10 items-center gap-2 rounded-lg border border-[#e5eae5] px-3 text-xs font-semibold text-[#52655b] disabled:opacity-50"><Download size={13}/> Exporter</button>
        {canWrite && <button type="button" onClick={() => setCreating(true)} className="flex h-10 items-center gap-2 rounded-lg bg-[#32743d] px-4 text-xs font-bold text-white"><Plus size={14}/> Ajouter un bien</button>}
      </div>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-[#fbf0ee] p-3 text-xs text-[#8d3c32]">{error}</p>}
    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">
      <section aria-labelledby="admin-listings-title" className="min-w-0">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="admin-listings-title" className="text-base font-semibold text-[#18371d]">Annonces</h2><p className="mt-1 text-xs text-[#56605a]">{filtered.length} sur {properties.length} · données chargées depuis le serveur</p></div></div>
        <div className="space-y-3">
          {filtered.map((property) => {
            const photo = property.photos?.[0];
            const isPositioned = property.publicationStatus === "published" && Boolean(property.coordinates);
            return <article key={property.id} className="overflow-hidden rounded-2xl border border-[#e6ebe6] bg-white shadow-sm sm:flex">
              <ListingThumbnail key={photo?.previewSrc ?? photo?.src ?? "empty"} photo={photo}/>
              <div className="min-w-0 flex-1 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-sm font-bold text-[#18371d]">{property.title}</h3><p className="mt-1 text-xs text-[#56605a]">{property.location}</p></div><span className="rounded-full bg-[#edf4ed] px-2.5 py-1 text-xs font-bold text-[#32743d]">{({ draft: "Brouillon", review: "À vérifier", published: "Publié", archived: "Archivé" } as const)[property.publicationStatus]}</span></div>
                <p className="mt-3 text-sm font-bold text-[#18371d]">{property.priceLabel}</p>
                <p className="mt-1 text-xs leading-5 text-[#56605a]">{property.kind} · {property.area} m² · Réf. {property.ref}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-2 text-[#52655b]"><span className="sr-only">Disponibilité {property.ref}</span><select aria-label={`Disponibilité ${property.ref}`} disabled={!canWrite || busyId === property.id} value={property.status} onChange={(event) => updateStatus(property, event.target.value)} className="rounded-full border border-[#dce9dd] bg-[#f3f7f2] px-3 py-1.5 text-xs font-semibold text-[#32743d] disabled:opacity-70"><option>Disponible</option><option>À louer</option><option>Réservé</option><option>Vendu</option></select></label>
                  {isPositioned ? <button type="button" onClick={() => setFocus((current) => ({ id: property.id, nonce: current.nonce + 1 }))} className="inline-flex items-center gap-1 font-semibold text-[#32743d]"><MapPin size={14}/>Voir sur la carte</button> : <span className="text-[#56605a]">{property.publicationStatus === "published" ? "Position non renseignée" : "Non affichée sur la carte"}</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#edf0ed] pt-3 text-xs font-semibold text-[#32743d]">
                  {canWrite && <><button type="button" onClick={() => setEditing(property)} aria-label={`Modifier ${property.ref}`} className="inline-flex items-center gap-1"><Pencil size={14}/>Modifier</button><button type="button" onClick={() => setDuplicating(property)} aria-label={`Dupliquer ${property.ref}`} className="inline-flex items-center gap-1"><Copy size={14}/>Dupliquer</button></>}
                  {canReadFiles && <Link href={`/admin/biens/${property.id}/fichiers`} aria-label={`Fichiers ${property.ref}`}>Fichiers</Link>}
                  {property.category === "terrain" && <Link href={`/admin/biens/${property.id}/geospatial`} aria-label={`Fiche géospatiale ${property.ref}`}>Fiche géospatiale</Link>}
                  {canReview && property.publicationStatus === "review" && <button type="button" onClick={() => setReviewing(property)}>Contrôler</button>}
                  {property.publicationStatus === "published" && <Link href={`/${property.category === "terrain" ? "terrains" : "immobilier"}/${property.slug}`} target="_blank" aria-label={`Voir ${property.ref}`} className="inline-flex items-center gap-1">Voir <Eye size={12}/><ArrowUpRight size={11}/></Link>}
                </div>
              </div>
            </article>;
          })}
          {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-[#dce6dc] bg-white p-10 text-center text-sm text-[#56605a]">Aucune annonce ne correspond à cette recherche.</p>}
        </div>
      </section>
      <section aria-labelledby="admin-map-title" className="min-w-0 rounded-2xl border border-[#e6ebe6] bg-white p-4 xl:sticky xl:top-24">
        <h2 id="admin-map-title" className="text-base font-semibold text-[#18371d]">Carte des annonces publiées</h2>
        <p className="mb-4 mt-1 text-xs leading-5 text-[#56605a]">{markers.length} repère(s) approximatif(s) parmi les résultats. Les brouillons et annonces non publiées restent hors de la carte.</p>
        <CesiumMapPanel markers={markers} focusId={focus.id} focusNonce={focus.nonce} heightClassName="h-[320px] xl:h-[520px]" note="Positions approximatives des annonces publiées uniquement ; aucun emplacement exact de parcelle n’est affiché."/>
      </section>
    </div>
    {(creating || editing) && <ListingForm key={editing?.id ?? "new"} listing={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={refresh}/>}
    {duplicating && <ListingForm key={`duplicate-${duplicating.id}`} listing={duplicating} duplicate onClose={() => setDuplicating(null)} onSaved={refresh}/>}
    {reviewing && <ReviewForm key={reviewing.id} listing={reviewing} onClose={() => setReviewing(null)} onSaved={refresh}/>}
  </>;
}
