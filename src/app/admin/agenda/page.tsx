"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Video, X } from "lucide-react";
import { adminApi, type AdminAppointment } from "@/lib/admin-api";
import { AdminVisits } from "@/components/admin-visits";

const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date);
}

export default function AdminAgendaPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const weekDays = useMemo(() => dayLabels.map((label, index) => ({
    label,
    date: addDays(weekStart, index),
  })), [weekStart]);

  async function refresh() {
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    const result = await adminApi<AdminAppointment[]>(`/api/admin/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    setAppointments(result);
    setError("");
  }

  useEffect(() => {
    let active = true;
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    adminApi<AdminAppointment[]>(`/api/admin/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((result) => { if (active) setAppointments(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "L’agenda n’a pas pu être chargé."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [weekStart]);

  const selectedDate = weekDays[selectedDay]?.date ?? weekStart;
  const dayAppointments = appointments.filter((appointment) => {
    const date = new Date(appointment.starts_at);
    return date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate();
  });

  async function changeStatus(appointment: AdminAppointment, status: string) {
    setError("");
    try {
      await adminApi(`/api/admin/appointments/${appointment.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setAppointments((current) => current.map((item) => item.id === appointment.id ? { ...item, status } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le statut du rendez-vous n’a pas pu être modifié.");
    }
  }

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    setSaving(true);
    try {
      const localDate = String(formData.get("startsAt"));
      const scheduledDate = new Date(localDate);
      await adminApi("/api/admin/appointments", {
        method: "POST",
        body: JSON.stringify({
          contactName: formData.get("contactName"),
          contactEmail: formData.get("contactEmail"),
          purpose: formData.get("purpose"),
          startsAt: scheduledDate.toISOString(),
          location: formData.get("location"),
        }),
      });
      const scheduledWeek = startOfWeek(scheduledDate);
      setSelectedDay((scheduledDate.getDay() + 6) % 7);
      setWeekStart(scheduledWeek);
      setLoading(true);
      if (scheduledWeek.getTime() === weekStart.getTime()) await refresh();
      setAdding(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le rendez-vous n’a pas pu être créé.");
    } finally {
      setSaving(false);
    }
  }

  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60856c]">Organisation</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#18371d] sm:text-3xl">Agenda & rendez-vous</h1><p className="mt-2 text-xs text-[#718078]">Les rendez-vous sont enregistrés et modifiables depuis cet espace.</p></div><button type="button" onClick={() => setAdding(true)} className="flex w-fit items-center gap-2 rounded-lg bg-[#32743d] px-4 py-2.5 text-[10px] font-bold text-white"><Plus size={14}/> Planifier un rendez-vous</button></div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e6ebe6] bg-white p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edf4ee] text-[#3d7759]"><CalendarDays size={18}/></span><div><h2 className="text-xs font-bold text-[#344b3f]">Semaine du {shortDate(weekStart)}</h2><p className="mt-1 text-[9px] text-[#89948d]">{loading ? "Chargement…" : `${appointments.length} rendez-vous`}</p></div></div><div className="flex gap-2"><button type="button" aria-label="Semaine précédente" onClick={() => { setWeekStart((date) => addDays(date, -7)); setSelectedDay(0); setLoading(true); }} className="grid size-8 place-items-center rounded-lg border border-[#e5eae5] text-[#607168]"><ChevronLeft size={15}/></button><button type="button" onClick={() => { const today = new Date(); setWeekStart(startOfWeek(today)); setSelectedDay((today.getDay() + 6) % 7); setLoading(true); }} className="rounded-lg border border-[#e5eae5] px-3 text-[9px] font-semibold text-[#607168]">Aujourd’hui</button><button type="button" aria-label="Semaine suivante" onClick={() => { setWeekStart((date) => addDays(date, 7)); setSelectedDay(0); setLoading(true); }} className="grid size-8 place-items-center rounded-lg border border-[#e5eae5] text-[#607168]"><ChevronRight size={15}/></button></div></div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-[#fbf0ee] p-3 text-xs text-[#8d3c32]">{error}</p>}
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{weekDays.map(({ label, date }, index) => {
      const active = selectedDay === index;
      const count = appointments.filter((appointment) => {
        const starts = new Date(appointment.starts_at);
        return starts.getFullYear() === date.getFullYear() && starts.getMonth() === date.getMonth() && starts.getDate() === date.getDate();
      }).length;
      return <button type="button" key={date.toISOString()} onClick={() => setSelectedDay(index)} aria-pressed={active} className={`rounded-xl border p-3 text-center ${active ? "border-[#32743d] bg-[#32743d] text-white" : "border-[#e6ebe6] bg-white text-[#687970]"}`}><span className={`block text-[9px] ${active ? "text-white/70" : "text-[#9aa49e]"}`}>{label}</span><span className="mt-1 block text-sm font-bold">{date.getDate()}</span><span className="mt-1 block text-[8px]">{count} rendez-vous</span></button>;
    })}</div>
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#e6ebe6] bg-white"><div className="flex items-center justify-between border-b border-[#edf0ed] p-5"><div><h2 className="text-sm font-bold text-[#18371d]">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(selectedDate)}</h2><p className="mt-1 text-[9px] text-[#89948d]">Heure locale de votre navigateur</p></div><span className="rounded-full bg-[#edf4ee] px-2.5 py-1 text-[9px] font-semibold text-[#477052]">{dayAppointments.length} rendez-vous</span></div>
      {loading ? <p className="p-10 text-center text-xs text-[#849188]">Chargement de l’agenda…</p>
        : dayAppointments.length === 0 ? <p className="p-10 text-center text-xs text-[#849188]">Aucun rendez-vous prévu ce jour.</p>
          : <div className="divide-y divide-[#f0f2f0]">{dayAppointments.map((appointment) => {
            const starts = new Date(appointment.starts_at);
            return <article key={appointment.id} className="grid grid-cols-[64px_1fr] gap-4 p-4 sm:grid-cols-[72px_1fr_auto] sm:items-center"><span className="flex items-center gap-1.5 text-[10px] font-bold text-[#61736a]"><Clock3 size={12}/>{new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(starts)}</span><div className="flex gap-3"><span className="mt-1 h-9 w-1 shrink-0 rounded-full bg-[#88ad91]"/><div><h3 className="text-[11px] font-bold text-[#354b40]">{appointment.purpose}</h3><p className="mt-1 text-[9px] text-[#89948d]">{appointment.contact_name} · <a className="text-[#589262]" href={`mailto:${appointment.contact_email}`}>{appointment.contact_email}</a></p><span className="mt-2 inline-flex items-center gap-1 text-[8px] text-[#849188]">{appointment.purpose.toLowerCase().includes("visio") ? <Video size={11}/> : <MapPin size={11}/>} {appointment.location || "Lieu à confirmer"}</span></div></div><label className="col-start-2 text-[8px] text-[#849188] sm:col-start-auto">Statut<select aria-label={`Statut rendez-vous ${appointment.contact_name}`} value={appointment.status} onChange={(event) => changeStatus(appointment, event.target.value)} className="ml-2 rounded-full bg-[#eef4ee] px-2 py-1.5 text-[9px] font-semibold text-[#477052]"><option>À confirmer</option><option>Confirmé</option><option>Annulé</option></select></label></article>;
          })}</div>}</section>
    {process.env.NEXT_PUBLIC_VISIT_AGENDA_ENABLED === "true" && <AdminVisits onUpdated={async () => {
      try { await refresh(); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "L’agenda n’a pas pu être actualisé."); }
    }}/>}
    {adding && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#17251bcc] p-4"><section role="dialog" aria-modal="true" aria-labelledby="appointment-form-title" className="my-auto w-full max-w-lg rounded-2xl bg-white p-6"><div className="flex items-center justify-between"><h2 id="appointment-form-title" className="text-lg font-semibold text-[#18371d]">Planifier un rendez-vous</h2><button type="button" onClick={() => setAdding(false)} aria-label="Fermer"><X size={18}/></button></div><form onSubmit={createAppointment} className="mt-4 space-y-3">
      <label className="block text-xs font-semibold text-[#52655b]">Nom du contact<input name="contactName" required minLength={2} maxLength={120} className="admin-field"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">E-mail<input name="contactEmail" type="email" required maxLength={254} className="admin-field"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">Objet<input name="purpose" required minLength={3} maxLength={240} className="admin-field"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">Date et heure (heure locale)<input name="startsAt" type="datetime-local" required className="admin-field"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">Lieu / lien de visioconférence<input name="location" maxLength={240} className="admin-field"/></label>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-[#e5eae5] px-4 py-2 text-xs font-semibold text-[#52655b]">Annuler</button><button disabled={saving} className="rounded-lg bg-[#32743d] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer"}</button></div>
    </form></section></div>}
  </div>;
}
