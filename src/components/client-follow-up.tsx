"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Heart, Trash2 } from "lucide-react";
import { clientApi } from "@/lib/client-http";
import { createClient } from "@/lib/supabase/browser";

export type CatalogEntry = { slug: string; title: string; href: string; priceLabel: string };

type Notification = { id: string; title: string; body: string; createdAt: string; read: boolean };
type Alert = { id: string; criteria: Record<string, string | number>; createdAt: string };

const criteriaLabels: Record<string, string> = { category: "Catégorie", region: "Région", prixMax: "Prix maximum", surfaceMin: "Surface minimum" };
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function describeCriteria(criteria: Record<string, string | number>) {
  return Object.entries(criteria).map(([key, value]) => `${criteriaLabels[key] ?? key} : ${key === "category" ? (value === "terrain" ? "terrain" : "immobilier") : String(value)}`).join(" · ");
}

export function ClientFollowUp({ catalog }: { catalog: CatalogEntry[] }) {
  const [favorites, setFavorites] = useState<string[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [favoriteBody, alertBody, notificationBody] = await Promise.all([
        clientApi<{ favorites: string[] }>("/api/client/favorites"),
        clientApi<{ alerts: Alert[] }>("/api/client/alerts"),
        clientApi<{ notifications: Notification[] }>("/api/client/notifications"),
      ]);
      setFavorites(favoriteBody.favorites);
      setAlerts(alertBody.alerts);
      setNotifications(notificationBody.notifications);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Votre espace n’a pas pu être chargé.");
    }
  }

  useEffect(() => {
    // Le chargement dépend de la session stockée dans le navigateur : il démarre après le montage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’action n’a pas pu être effectuée.");
    } finally {
      setBusy(false);
    }
  }

  async function addAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const criteria: Record<string, string | number> = {};
    const category = String(data.get("category") ?? "");
    const region = String(data.get("region") ?? "").trim();
    const prixMax = String(data.get("prixMax") ?? "").trim();
    const surfaceMin = String(data.get("surfaceMin") ?? "").trim();
    if (category) criteria.category = category;
    if (region) criteria.region = region;
    if (prixMax) criteria.prixMax = Number(prixMax);
    if (surfaceMin) criteria.surfaceMin = Number(surfaceMin);
    await run(() => clientApi("/api/client/alerts", { method: "POST", body: { criteria } }));
    form.reset();
  }

  const titleBySlug = new Map(catalog.map((entry) => [entry.slug, entry]));

  return <div className="space-y-10">
    {error && <p role="alert" className="rounded-xl bg-[#fbf0ee] px-4 py-3 text-xs leading-5 text-[#8d3c32]">{error}</p>}

    <section aria-labelledby="notifications-title">
      <h2 id="notifications-title" className="text-xl font-semibold tracking-tight text-[#18371d]">Notifications</h2>
      <p className="mt-1 text-xs text-[#718078]">Changements d’étape de vos demandes. Un e-mail pourra vous être envoyé lorsque l’envoi sera activé.</p>
      {notifications === null && !error && <p className="mt-3 text-sm text-[#718078]">Chargement…</p>}
      {notifications && notifications.length === 0 && <p className="mt-3 text-sm text-[#718078]">Aucune notification pour le moment.</p>}
      {notifications && notifications.length > 0 && <>
        <ul className="mt-3 space-y-2">{notifications.map((item) => <li key={item.id} className={`rounded-xl border p-3 text-xs leading-5 ${item.read ? "border-[#e5e9e3] bg-white" : "border-[#c9dccb] bg-[#f3f7f2]"}`}>
          <strong className="block text-[#18371d]">{item.title}</strong>
          <span className="block text-[#596b61]">{item.body}</span>
          <span className="mt-1 block text-[11px] text-[#89938d]">{dateFormatter.format(new Date(item.createdAt))}{!item.read && " · nouveau"}</span>
        </li>)}</ul>
        {notifications.some((item) => !item.read) && <button type="button" disabled={busy} onClick={() => void run(() => clientApi("/api/client/notifications/read", { method: "POST" }))} className="mt-3 text-xs font-bold text-[#32743d] disabled:opacity-60">Tout marquer comme lu</button>}
      </>}
    </section>

    <section aria-labelledby="favorites-title">
      <h2 id="favorites-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[#18371d]"><Heart size={18}/>Mes favoris</h2>
      {favorites && favorites.length === 0 && <p className="mt-3 text-sm text-[#718078]">Ajoutez un bien depuis sa fiche avec le bouton « Ajouter aux favoris ».</p>}
      {favorites && favorites.length > 0 && <ul className="mt-3 space-y-2">{favorites.map((slug) => {
        const entry = titleBySlug.get(slug);
        return <li key={slug} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e9e3] bg-white p-3 text-xs">
          {entry ? <a href={entry.href} className="min-w-0 flex-1 font-semibold text-[#18371d] hover:underline"><span className="block truncate">{entry.title}</span><span className="text-[11px] font-normal text-[#718078]">{entry.priceLabel}</span></a> : <span className="text-[#718078]">Bien retiré du catalogue</span>}
          <button type="button" disabled={busy} onClick={() => void run(() => clientApi(`/api/client/favorites/${slug}`, { method: "DELETE" }))} aria-label={`Retirer ${entry?.title ?? slug} des favoris`} className="rounded-lg p-2 text-[#89948d] hover:bg-[#f3f5f2] hover:text-[#8d3c32] disabled:opacity-60"><Trash2 size={14}/></button>
        </li>;
      })}</ul>}
    </section>

    <section aria-labelledby="alerts-title">
      <h2 id="alerts-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[#18371d]"><BellRing size={18}/>Mes alertes</h2>
      <p className="mt-1 text-xs leading-5 text-[#718078]">Enregistrez vos critères de recherche. L’envoi des alertes n’est pas encore activé : vous pouvez consulter vos critères ici.</p>
      <form onSubmit={addAlert} className="mt-3 grid gap-3 rounded-2xl border border-[#e5e9e3] bg-white p-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-[#43584e]">Catégorie<select name="category" defaultValue="" disabled={busy} className="mt-1 block h-10 w-full rounded-xl border border-[#e5e9e3] bg-[#fbfcfa] px-3 text-xs font-normal"><option value="">Toutes</option><option value="terrain">Terrain</option><option value="immobilier">Immobilier</option></select></label>
        <label className="text-xs font-semibold text-[#43584e]">Région<input name="region" maxLength={80} disabled={busy} placeholder="Thiès" className="mt-1 block h-10 w-full rounded-xl border border-[#e5e9e3] bg-[#fbfcfa] px-3 text-xs font-normal"/></label>
        <label className="text-xs font-semibold text-[#43584e]">Prix maximum (FCFA)<input name="prixMax" type="number" min="1" step="1" disabled={busy} className="mt-1 block h-10 w-full rounded-xl border border-[#e5e9e3] bg-[#fbfcfa] px-3 text-xs font-normal"/></label>
        <label className="text-xs font-semibold text-[#43584e]">Surface minimum (m²)<input name="surfaceMin" type="number" min="1" step="1" disabled={busy} className="mt-1 block h-10 w-full rounded-xl border border-[#e5e9e3] bg-[#fbfcfa] px-3 text-xs font-normal"/></label>
        <div className="sm:col-span-2"><button disabled={busy} className="rounded-full bg-[#1c4523] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60">Enregistrer cette alerte</button></div>
      </form>
      {alerts && alerts.length > 0 && <ul className="mt-3 space-y-2">{alerts.map((alert) => <li key={alert.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e9e3] bg-white p-3 text-xs">
        <span className="min-w-0 flex-1 text-[#43584e]">{describeCriteria(alert.criteria)}</span>
        <button type="button" disabled={busy} onClick={() => void run(() => clientApi(`/api/client/alerts/${alert.id}`, { method: "DELETE" }))} aria-label="Supprimer cette alerte" className="rounded-lg p-2 text-[#89948d] hover:bg-[#f3f5f2] hover:text-[#8d3c32] disabled:opacity-60"><Trash2 size={14}/></button>
      </li>)}</ul>}
    </section>
  </div>;
}

export function ClientAccountDeletion() {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await clientApi("/api/client/account", { method: "DELETE" });
      await createClient().auth.signOut({ scope: "local" }).catch(() => undefined);
      router.replace("/espace-client/connexion?compte=supprime");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le compte n’a pas pu être supprimé.");
      setBusy(false);
    }
  }

  return <section aria-labelledby="delete-title" className="rounded-2xl border border-[#ead9cf] bg-[#fdf8f5] p-5">
    <h2 id="delete-title" className="text-sm font-bold text-[#7a3d2a]">Supprimer mon compte</h2>
    <p className="mt-2 text-xs leading-5 text-[#7a5d52]">Cette action efface vos demandes, notes liées, alertes, favoris et notifications. Votre compte d’accès est supprimé. Les prospects liés sont anonymisés pour la gestion commerciale minimale. Cette action est définitive.</p>
    <label className="mt-3 flex items-start gap-2 text-xs text-[#7a5d52]"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-4 accent-[#7a3d2a]"/>Je comprends que la suppression est définitive.</label>
    {error && <p role="alert" className="mt-3 rounded-lg bg-[#fbf0ee] p-2 text-xs text-[#8d3c32]">{error}</p>}
    <button type="button" disabled={!confirmed || busy} onClick={() => void remove()} className="mt-4 rounded-full border border-[#c99e8c] bg-white px-5 py-2.5 text-xs font-bold text-[#7a3d2a] disabled:opacity-50">{busy ? "Suppression…" : "Supprimer définitivement mon compte"}</button>
  </section>;
}
