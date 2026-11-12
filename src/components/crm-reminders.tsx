"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { adminApi, type LeadReminder } from "@/lib/admin-api";

type Props = {
  reminders: LeadReminder[];
  loading: boolean;
  error: string;
  canWrite: boolean;
  onRefresh: () => Promise<void>;
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Dakar" });

export function CrmReminders({ reminders, loading, error, canWrite, onRefresh }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  async function complete(reminder: LeadReminder) {
    setBusy(reminder.id);
    setActionError("");
    try {
      await adminApi(`/api/admin/reminders/${reminder.id}`, { method: "PATCH", body: JSON.stringify({ done: true }) });
      try {
        await onRefresh();
      } catch {
        setActionError("La relance a été terminée, mais l’actualisation a échoué. Rechargez la page.");
      }
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "La relance n’a pas pu être terminée.");
    } finally {
      setBusy(null);
    }
  }

  return <section aria-labelledby="crm-reminders-title" className="mt-5 rounded-2xl border border-[#e7e0d4] bg-white p-4 sm:p-5">
    <h2 id="crm-reminders-title" className="flex items-center gap-2 text-base font-semibold text-[#174c38]"><BellRing size={18} aria-hidden="true"/>Relances à suivre</h2>
    <p className="mt-1 text-xs leading-5 text-[#52655b]">Rappels internes, sans notification automatique. Jusqu’à 200 relances ouvertes, classées par échéance · heure du Sénégal.</p>
    {loading && <p role="status" className="mt-3 text-sm text-[#52655b]">Chargement des relances…</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-[#fbf0ee] p-3 text-sm text-[#8d3c32]">Relances indisponibles : {error}</p>}
    {actionError && <p role="alert" className="mt-3 rounded-lg bg-[#fbf0ee] p-3 text-sm text-[#8d3c32]">{actionError}</p>}
    {!loading && !error && reminders.length === 0 && <p className="mt-3 text-sm text-[#52655b]">Aucune relance ouverte.</p>}
    {!loading && !error && reminders.length > 0 && <ul className="mt-3 grid gap-2 lg:grid-cols-2">{reminders.map((reminder) => <li key={reminder.id} className="rounded-xl border border-[#e7e0d4] bg-[#faf8f3] p-3 text-sm text-[#263238]">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{reminder.leadName}</strong><p className="mt-1 text-xs text-[#52655b]"><time dateTime={reminder.dueAt}>{dateFormat.format(new Date(reminder.dueAt))}</time>{now !== null && Date.parse(reminder.dueAt) < now ? " · En retard" : ""}</p></div>
        {canWrite && <button type="button" disabled={busy !== null} onClick={() => void complete(reminder)} className="min-h-11 rounded-lg border border-[#c9dccb] bg-white px-3 text-xs font-semibold text-[#174c38] disabled:opacity-60">{busy === reminder.id ? "Enregistrement…" : "Marquer effectuée"}</button>}
      </div>
      <p className="mt-2 text-xs leading-5 text-[#52655b]">{reminder.note || "Motif non renseigné"} · Responsable : {reminder.assignedTo ?? "non renseigné"}</p>
    </li>)}</ul>}
  </section>;
}
