"use client";

import { useCallback, useEffect, useState } from "react";
import { clientVisits } from "@/lib/client-api";
import { visitDate, visitDateInput, type VisitAction, type VisitWorkflow } from "@/lib/visits";

function VisitCard({ visit, onChange }: { visit: VisitWorkflow; onChange: (message: string) => Promise<void> }) {
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(action: VisitAction) {
    setBusy(true);
    setError("");
    try {
      const proposed = action === "request_reschedule" ? visitDateInput(date) : undefined;
      await clientVisits(visit.id, action, visit.revision, proposed);
      await onChange(action === "accept_offer" ? "La nouvelle date est confirmée." : "Votre demande a été envoyée à l’agence ; elle reste à valider.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "L’action a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return <article className="rounded-2xl border border-[#e5e9e3] bg-white p-5">
    <h3 className="font-bold text-[#18371d]">{visit.purpose}</h3>
    <p className="mt-2 text-sm text-[#596b61]">{visitDate(visit.startsAt)} (heure du Sénégal) · {visit.status}</p>
    {visit.pending === "cancel" && <p className="mt-3 text-sm text-[#775d34]">Demande d’annulation transmise : le rendez-vous n’est pas encore annulé.</p>}
    {visit.pending === "reschedule" && visit.proposedAt && <p className="mt-3 text-sm text-[#775d34]">Demande de changement au {visitDate(visit.proposedAt)} transmise ; l’agence doit répondre.</p>}
    {visit.pending === "offer" && visit.proposedAt && <div className="mt-3 rounded-xl bg-[#edf4ee] p-3 text-sm text-[#43584e]">
      <p>L’agence propose le <strong>{visitDate(visit.proposedAt)}</strong> (heure du Sénégal). La nouvelle date n’est pas confirmée sans votre accord.</p>
      <button disabled={busy} onClick={() => void act("accept_offer")} className="mt-3 rounded-full bg-[#32743d] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Accepter cette date</button>
    </div>}
    {visit.status !== "Annulé" && (visit.pending === "none" || visit.pending === "offer") && <div className="mt-4 space-y-3">
      <button disabled={busy} onClick={() => void act("request_cancel")} className="rounded-lg border border-[#dfe6df] px-3 py-2 text-xs font-semibold text-[#43584e] disabled:opacity-50">Demander l’annulation</button>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-[#43584e]">Autre date souhaitée (heure du Sénégal)<input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block rounded-lg border border-[#dfe6df] px-3 py-2 text-sm"/></label>
        <button disabled={busy} onClick={() => void act("request_reschedule")} className="rounded-lg border border-[#32743d] px-3 py-2 text-xs font-semibold text-[#32743d] disabled:opacity-50">Demander une reprogrammation</button>
      </div>
    </div>}
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
  </article>;
}

export function ClientVisits() {
  const [visits, setVisits] = useState<VisitWorkflow[] | null>(null);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await clientVisits(undefined, undefined, undefined, undefined, offset); setVisits(result.visits); setHasMore(result.hasMore); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Les visites n’ont pas pu être chargées."); }
    finally { setLoading(false); }
  }, [offset]);
  useEffect(() => {
    // Le chargement dépend de la session disponible après montage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  return <section>
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-[#18371d]">Mes visites</h2><button onClick={() => void load()} className="rounded-full border border-[#dfe6df] px-4 py-2 text-xs font-bold text-[#18371d]">Actualiser</button></div>
    <p className="mt-2 text-xs text-[#718078]">Les demandes de changement doivent être validées par l’agence. Aucun e-mail automatique n’est envoyé.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-[#32743d]">{notice}</p>}
    {!visits && !error && <p className="mt-3 text-sm text-[#718078]">Chargement…</p>}
    {visits?.length === 0 && <p className="mt-3 text-sm text-[#718078]">Aucune visite enregistrée.</p>}
    {visits && !error && !loading && <div className="mt-4 space-y-3">{visits.map((visit) => <VisitCard key={visit.id} visit={visit} onChange={async (message) => { setNotice(message); await load(); }}/>)}</div>}
    <div className="mt-4 flex gap-2"><button disabled={offset === 0 || loading} onClick={() => setOffset((value) => value - 50)} className="rounded-lg border border-[#dfe6df] px-3 py-2 text-xs disabled:opacity-40">Précédent</button><span className="self-center text-xs text-[#718078]">Page {offset / 50 + 1}</span><button disabled={!hasMore || loading} onClick={() => setOffset((value) => value + 50)} className="rounded-lg border border-[#dfe6df] px-3 py-2 text-xs disabled:opacity-40">Suivant</button></div>
  </section>;
}
