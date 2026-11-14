"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BellRing, MessageSquarePlus, UserRoundPlus } from "lucide-react";
import { adminApi, type AdminLead, type LeadEvent } from "@/lib/admin-api";
import { useAdminSession } from "@/components/admin-session";

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const kindLabels: Record<LeadEvent["kind"], string> = {
  note: "Note",
  reply: "Réponse envoyée",
  stage: "Étape",
  assignment: "Affectation",
  reminder: "Relance",
};

type Props = {
  lead: AdminLead;
  onChanged: () => Promise<void>;
};

export function LeadFollowUp({ lead, onChanged }: Props) {
  const { session, can } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<LeadEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const canWrite = can("leads:write");

  useEffect(() => {
    if (!open) return;
    let active = true;
    adminApi<LeadEvent[]>(`/api/admin/leads/${lead.id}/events`)
      .then((result) => { if (active) setEvents(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "L’historique n’a pas pu être chargé."); });
    return () => { active = false; };
  }, [open, lead.id, refresh]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      try {
        await onChanged();
      } catch {
        setError("L’action a été enregistrée, mais l’actualisation a échoué. Rechargez la page.");
      }
      setRefresh((value) => value + 1);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’action n’a pas pu être effectuée.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    const saved = await run(async () => {
      await adminApi(`/api/admin/leads/${lead.id}/events`, { method: "POST", body: JSON.stringify({ kind: "note", body }) });
    });
    if (saved) form.reset();
  }

  async function addReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const day = String(data.get("dueDate") ?? "");
    const note = String(data.get("note") ?? "").trim();
    const saved = await run(async () => {
      await adminApi(`/api/admin/leads/${lead.id}/reminders`, {
        method: "POST",
        body: JSON.stringify({ dueAt: new Date(`${day}T09:00:00Z`).toISOString(), note }),
      });
    });
    if (saved) form.reset();
  }

  return <div className="mt-2">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="text-xs font-semibold text-[#589262]">
      {open ? "Masquer le suivi" : "Suivi, notes et relances"}
    </button>
    {open && <div className="mt-2 space-y-3 rounded-lg bg-[#f7f8f5] p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[#52655a]">Affecté à : <strong>{lead.assigned_to ?? "personne"}</strong></span>
        {canWrite && lead.assigned_to !== session.email && <button type="button" disabled={busy} onClick={() => void run(() => adminApi(`/api/admin/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ assignedTo: session.email }) }))} className="inline-flex items-center gap-1 rounded-full border border-[#dce9dd] bg-white px-2.5 py-1 font-semibold text-[#3d7759] disabled:opacity-60"><UserRoundPlus size={12}/>Me l’affecter</button>}
        {canWrite && lead.assigned_to && <button type="button" disabled={busy} onClick={() => void run(() => adminApi(`/api/admin/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ assignedTo: null }) }))} className="rounded-full border border-[#e5eae5] bg-white px-2.5 py-1 font-semibold text-[#52655b] disabled:opacity-60">Retirer</button>}
      </div>

      {error && <p role="alert" className="rounded bg-[#fbf0ee] p-2 text-[#8d3c32]">{error}</p>}

      {canWrite && <form onSubmit={addNote} className="space-y-2">
        <label className="block font-semibold text-[#52655b]">Note interne ou réponse envoyée
          <textarea name="body" required minLength={1} maxLength={2000} rows={2} disabled={busy} className="mt-1 block w-full rounded-lg border border-[#e5eae5] bg-white p-2 text-xs font-normal"/>
        </label>
        <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-[#32743d] px-3 py-1.5 font-bold text-white disabled:opacity-60"><MessageSquarePlus size={13}/>Enregistrer la note</button>
      </form>}

      {canWrite && <form onSubmit={addReminder} className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
        <label className="font-semibold text-[#52655b]">Relancer le (9 h, Sénégal)
          <input name="dueDate" type="date" required disabled={busy} className="mt-1 block rounded-lg border border-[#e5eae5] bg-white p-1.5 font-normal"/>
        </label>
        <label className="font-semibold text-[#52655b]">Motif
          <input name="note" maxLength={500} disabled={busy} className="mt-1 block w-full rounded-lg border border-[#e5eae5] bg-white p-1.5 font-normal"/>
        </label>
        <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9dccb] bg-white px-3 py-1.5 font-bold text-[#3d7759] disabled:opacity-60"><BellRing size={13}/>Planifier</button>
      </form>}

      <div>
        <p className="mb-1 font-semibold text-[#52655a]">Historique</p>
        {!events && !error && <p className="text-[#56605a]">Chargement…</p>}
        {events && events.length === 0 && <p className="text-[#56605a]">Aucune action enregistrée pour ce prospect.</p>}
        <ul className="space-y-2">
          {events?.map((event) => <li key={event.id} className="rounded-lg bg-white p-2">
            <span className="block text-[11px] text-[#56605a]">{dateTimeFormatter.format(new Date(event.at))} · {kindLabels[event.kind]} · {event.actor}</span>
            {event.body && <p className="mt-1 whitespace-pre-wrap leading-5 text-[#3c4f45]">{event.body}</p>}
          </li>)}
        </ul>
      </div>
    </div>}
  </div>;
}
