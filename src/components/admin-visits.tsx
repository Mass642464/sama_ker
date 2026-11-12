"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { useAdminSession } from "@/components/admin-session";
import { visitDate, visitDateInput, type AdminVisitWorkflow, type VisitAction } from "@/lib/visits";

function AdminVisitCard({ visit, canWrite, onChange }: { visit: AdminVisitWorkflow; canWrite: boolean; onChange: (message: string) => Promise<void> }) {
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestedDate = visit.proposedAt ? new Date(visit.proposedAt).toISOString().slice(0, 16) : "";

  async function act(action: VisitAction, requestedDate?: string) {
    setBusy(true);
    setError("");
    try {
      const proposedAt = action === "propose" ? visitDateInput(requestedDate ?? date) : undefined;
      await adminApi(`/api/admin/visits/${visit.id}`, {
        method: "POST",
        body: JSON.stringify({ action, revision: visit.revision, ...(proposedAt ? { proposedAt } : {}) }),
      });
      await onChange(action === "propose" ? "Date proposée : en attente de l’accord du client." : "Modification enregistrée.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "L’action a échoué.");
    } finally { setBusy(false); }
  }

  return <article className="rounded-xl border border-[#e5e9e3] bg-white p-4">
    <div className="flex flex-wrap justify-between gap-2"><div><h3 className="text-sm font-bold text-[#18371d]">{visit.purpose}</h3><p className="mt-1 text-xs text-[#718078]">{visit.contactName} · {visit.contactEmail}</p></div><span className="text-xs font-bold text-[#3d7759]">{visit.status}</span></div>
    <p className="mt-2 text-xs text-[#43584e]">Date actuelle : {visitDate(visit.startsAt)} (heure du Sénégal)</p>
    {visit.pending === "cancel" && <p className="mt-2 text-xs font-bold text-[#775d34]">Le client demande l’annulation ; elle n’est pas encore validée.</p>}
    {visit.pending === "reschedule" && visit.proposedAt && <p className="mt-2 text-xs font-bold text-[#775d34]">Le client demande une autre date : {visitDate(visit.proposedAt)}.</p>}
    {visit.pending === "offer" && visit.proposedAt && <p className="mt-2 text-xs font-bold text-[#775d34]">Proposition du {visitDate(visit.proposedAt)} en attente de l’accord du client.</p>}
    {canWrite && visit.status !== "Annulé" && <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {visit.pending === "none" && visit.status === "À confirmer" && <button disabled={busy} onClick={() => void act("confirm")} className="rounded-lg bg-[#32743d] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Confirmer la date actuelle</button>}
        {visit.pending === "cancel" && <button disabled={busy} onClick={() => void act("accept_cancel")} className="rounded-lg bg-[#32743d] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Valider l’annulation</button>}
        {(visit.pending === "cancel" || visit.pending === "reschedule") && <button disabled={busy} onClick={() => void act("reject_request")} className="rounded-lg border border-[#dfe6df] px-3 py-2 text-xs font-bold text-[#43584e] disabled:opacity-50">Refuser la demande</button>}
        {visit.pending === "reschedule" && visit.proposedAt && <button disabled={busy} onClick={() => void act("propose", requestedDate)} className="rounded-lg bg-[#32743d] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Proposer la date demandée</button>}
      </div>
      {visit.pending !== "cancel" && <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-[#43584e]">Proposer une date (heure du Sénégal)<input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block rounded-lg border border-[#dfe6df] px-3 py-2 text-sm"/></label>
        <button disabled={busy} onClick={() => void act("propose")} className="rounded-lg border border-[#32743d] px-3 py-2 text-xs font-bold text-[#32743d] disabled:opacity-50">Proposer au client</button>
      </div>}
    </div>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </article>;
}

export function AdminVisits({ onUpdated }: { onUpdated: () => Promise<void> }) {
  const { can } = useAdminSession();
  const [visits, setVisits] = useState<AdminVisitWorkflow[] | null>(null);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi<{ visits: AdminVisitWorkflow[]; hasMore: boolean }>(`/api/admin/visits?offset=${offset}`);
      if (!Array.isArray(result.visits) || typeof result.hasMore !== "boolean") throw new Error("La réponse du service de visites est invalide.");
      setVisits(result.visits); setHasMore(result.hasMore); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Le suivi des visites n’a pas pu être chargé."); }
    finally { setLoading(false); }
  }, [offset]);
  useEffect(() => {
    // Le chargement dépend de la session disponible après montage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  return <section className="mt-8">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold text-[#18371d]">Demandes de visite et modifications</h2><p className="mt-1 text-xs text-[#718078]">Les propositions de date nécessitent l’accord du client. Gérez ici les visites issues du calendrier public.</p></div><button onClick={() => void load()} className="rounded-lg border border-[#dfe6df] px-3 py-2 text-xs font-bold text-[#43584e]">Actualiser</button></div>
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-xs text-[#32743d]">{notice}</p>}
    {!visits && !error && <p className="mt-3 text-xs text-[#718078]">Chargement…</p>}
    {visits?.length === 0 && <p className="mt-3 text-xs text-[#718078]">Aucune demande de visite.</p>}
    {visits && !error && !loading && <div className="mt-4 grid gap-3 lg:grid-cols-2">{visits.map((visit) => <AdminVisitCard key={visit.id} visit={visit} canWrite={can("appointments:write")} onChange={async (message) => { setNotice(message); await load(); await onUpdated(); }}/>)}</div>}
    <div className="mt-4 flex gap-2"><button disabled={offset === 0 || loading} onClick={() => setOffset((value) => value - 50)} className="rounded-lg border border-[#dfe6df] px-3 py-2 text-xs disabled:opacity-40">Précédent</button><span className="self-center text-xs text-[#718078]">Page {offset / 50 + 1}</span><button disabled={!hasMore || loading} onClick={() => setOffset((value) => value + 50)} className="rounded-lg border border-[#dfe6df] px-3 py-2 text-xs disabled:opacity-40">Suivant</button></div>
  </section>;
}
