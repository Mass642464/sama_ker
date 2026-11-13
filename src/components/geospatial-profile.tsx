"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { GeoField, GeoProfile, Reliability } from "../../backend/src/geospatial-profile-schema";
import { adminApi } from "@/lib/admin-api";
import { useAdminSession } from "@/components/admin-session";

type DraftEntry = { value: string; source: string; date: string; reliability: Reliability | "" };
type Draft = Record<GeoField, DraftEntry>;
type ResponseData = { profile: GeoProfile | null; revision: number; updatedAt: string | null };

const fields: { key: GeoField; label: string; help?: string }[] = [
  { key: "area", label: "Superficie (m²)", help: "Nombre en mètres carrés." },
  { key: "location", label: "Localisation" },
  { key: "latitude", label: "Latitude", help: "Coordonnée précise en degrés décimaux ; renseigner aussi la longitude." },
  { key: "longitude", label: "Longitude", help: "Coordonnée précise en degrés décimaux ; renseigner aussi la latitude." },
  { key: "zone", label: "Type de zone" },
  { key: "access", label: "Accès" },
  { key: "environment", label: "Environnement" },
  { key: "geometry", label: "Géométrie", help: "Objet GeoJSON Polygon WGS 84, longitude puis latitude, 200 positions maximum. Contours fermés ; trous acceptés." },
];
const geoFields = fields.map(({ key }) => key);

function emptyDraft(): Draft {
  return Object.fromEntries(geoFields.map((key) => [key, { value: "", source: "", date: "", reliability: "" }])) as Draft;
}

function fromProfile(profile: GeoProfile | null): Draft {
  const draft = emptyDraft();
  for (const key of geoFields) {
    const entry = profile?.[key];
    if (entry) draft[key] = { ...entry };
  }
  return draft;
}

export function GeospatialProfile({ listingId }: { listingId: string }) {
  const enabled = process.env.NEXT_PUBLIC_GEOSPATIAL_PROFILE_ENABLED === "true";
  const { can } = useAdminSession();
  const canWrite = can("properties:write");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminApi<ResponseData>(`/api/admin/geospatial-profile/${listingId}`);
      setDraft(fromProfile(response.profile));
      setRevision(response.revision);
      setUpdatedAt(response.updatedAt);
      setMessage("");
      setLoaded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La fiche n’a pas pu être chargée.");
    } finally { setLoading(false); }
  }, [listingId]);

  useEffect(() => {
    if (enabled) {
      // Le chargement synchronise la fiche avec l'API interne.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
  }, [enabled, load]);

  function update(key: GeoField, field: keyof DraftEntry, value: string) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const candidate = Object.fromEntries(geoFields.map((key) => [key, draft[key].value.trim() ? draft[key] : null]));
    setBusy(true);
    try {
      const saved = await adminApi<{ revision: number; updatedAt: string }>(`/api/admin/geospatial-profile/${listingId}`, {
        method: "PUT", body: JSON.stringify({ revision, profile: candidate }),
      });
      setRevision(saved.revision);
      setUpdatedAt(saved.updatedAt);
      setMessage("Fiche enregistrée. Elle ne modifie pas l’annonce publique.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La fiche n’a pas pu être enregistrée.");
    } finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-[#e6ebe6] bg-white p-4 sm:p-6">
    <p className="rounded-xl bg-[#f7f1e7] p-4 text-xs leading-5 text-[#775d34]">
      Fiche interne distincte de l’annonce. Ne renseignez que des données autorisées, avec leur provenance. « Vérifiée » est une appréciation saisie par l’équipe, pas une certification cadastrale ou juridique. Les données précises ne sont pas affichées sur la carte publique.
    </p>
    {!enabled && <p role="status" className="mt-4 rounded-lg bg-[#edf4ed] p-3 text-xs leading-5 text-[#43584e]">Aperçu désactivé : la saisie et l’enregistrement exigent la migration, les protections et une recette avant activation. N’y saisissez aucune donnée réelle.</p>}
    {loading && <p role="status" className="mt-4 text-xs text-[#718078]">Chargement de la fiche…</p>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] p-3 text-xs text-[#8d3c32]">{error}</p>}
    {message && <p role="status" className="mt-4 text-xs font-semibold text-[#32743d]">{message}</p>}
    {enabled && !loading && <button type="button" onClick={() => { if (window.confirm("Recharger la fiche et perdre les modifications non enregistrées ?")) void load(); }} className="mt-4 text-xs font-bold text-[#32743d] underline">Recharger la fiche</button>}
    {updatedAt && <p className="mt-3 text-xs text-[#718078]">Dernier enregistrement : {new Date(updatedAt).toLocaleString("fr-FR")}</p>}
    <form onSubmit={save} className="mt-5 space-y-4">
      {fields.map(({ key, label, help }) => {
        const entry = draft[key];
        const editable = enabled && canWrite && loaded && !loading && !busy;
        return <fieldset key={key} disabled={!editable} className="min-w-0 rounded-xl border border-[#e6ebe6] p-4 disabled:opacity-70">
          <legend className="px-1 text-sm font-bold text-[#18371d]">{label}</legend>
          {help && <p className="mb-3 text-xs leading-5 text-[#718078]">{help}</p>}
          <label className="block text-xs font-semibold text-[#52655b]">Valeur
            {key === "geometry" || key === "environment" || key === "access"
              ? <textarea value={entry.value} maxLength={key === "geometry" ? 10000 : 500} onChange={(event) => update(key, "value", event.target.value)} rows={key === "geometry" ? 4 : 2} className="admin-field"/>
              : <input value={entry.value} maxLength={500} inputMode={["area", "latitude", "longitude"].includes(key) ? "decimal" : "text"} onChange={(event) => update(key, "value", event.target.value)} className="admin-field"/>}
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-[#52655b]">Source<input value={entry.source} maxLength={200} required={Boolean(entry.value.trim())} onChange={(event) => update(key, "source", event.target.value)} className="admin-field"/></label>
            <label className="text-xs font-semibold text-[#52655b]">Date de la donnée<input type="date" value={entry.date} required={Boolean(entry.value.trim())} onChange={(event) => update(key, "date", event.target.value)} className="admin-field"/></label>
            <label className="text-xs font-semibold text-[#52655b]">Fiabilité<select value={entry.reliability} required={Boolean(entry.value.trim())} onChange={(event) => update(key, "reliability", event.target.value)} className="admin-field"><option value="">Choisir</option><option value="unknown">Non renseignée</option><option value="declared">Déclarative</option><option value="verified">Vérifiée par l’équipe</option><option value="outdated">À actualiser</option></select></label>
          </div>
        </fieldset>;
      })}
      <p className="text-xs leading-5 text-[#718078]">Chaque valeur renseignée exige sa source, sa date et sa fiabilité. Vider une valeur supprime aussi ses indications à l’enregistrement.</p>
      {enabled && !canWrite && <p className="text-xs text-[#718078]">Votre rôle permet uniquement la consultation.</p>}
      <button disabled={!enabled || !canWrite || !loaded || loading || busy} className="rounded-lg bg-[#32743d] px-5 py-3 text-xs font-bold text-white disabled:opacity-50">{busy ? "Enregistrement…" : "Enregistrer la fiche"}</button>
    </form>
  </section>;
}
