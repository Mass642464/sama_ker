"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, ClipboardList, MapPinned, UsersRound } from "lucide-react";
import { useAdminSession } from "@/components/admin-session";
import { adminApi, type AdminAppointment, type AdminDashboard, type AdminLead } from "@/lib/admin-api";

type LoadState<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };
const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : "Le chargement a échoué.";

export default function AdminDashboardPage() {
  const { session } = useAdminSession();
  const canDashboard = session.permissions.includes("dashboard:read");
  const canLeads = session.permissions.includes("leads:read");
  const canAppointments = session.permissions.includes("appointments:read");
  const canProperties = session.permissions.includes("properties:read");
  const [stats, setStats] = useState<LoadState<AdminDashboard>>({ status: "loading" });
  const [leads, setLeads] = useState<LoadState<AdminLead[]>>({ status: "loading" });
  const [appointments, setAppointments] = useState<LoadState<AdminAppointment[]>>({ status: "loading" });

  useEffect(() => {
    let active = true;
    if (canDashboard) {
      adminApi<AdminDashboard>("/api/admin/dashboard")
        .then((data) => { if (active) setStats({ status: "ready", data }); })
        .catch((reason: unknown) => { if (active) setStats({ status: "error", message: errorMessage(reason) }); });
    }
    if (canLeads) {
      adminApi<AdminLead[]>("/api/admin/leads")
        .then((data) => { if (active) setLeads({ status: "ready", data: data.slice(0, 5) }); })
        .catch((reason: unknown) => { if (active) setLeads({ status: "error", message: errorMessage(reason) }); });
    }
    if (canAppointments) {
      const now = new Date();
      const until = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      adminApi<AdminAppointment[]>(`/api/admin/appointments?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(until.toISOString())}`)
        .then((data) => { if (active) setAppointments({ status: "ready", data: data.filter((item) => item.status !== "Annulé").slice(0, 4) }); })
        .catch((reason: unknown) => { if (active) setAppointments({ status: "error", message: errorMessage(reason) }); });
    }
    return () => { active = false; };
  }, [canDashboard, canLeads, canAppointments]);

  const data = stats.status === "ready" ? stats.data : null;
  const metrics = [
    { label: "Annonces", value: data?.listings, detail: `${data?.published ?? "—"} publiées`, icon: MapPinned },
    { label: "Prospects", value: data?.leads, detail: `${data?.leadsToQualify ?? "—"} à qualifier`, icon: UsersRound },
    { label: "Rendez-vous à venir", value: data?.appointments, detail: "Toutes dates futures", icon: CalendarDays },
    { label: "Biens immobiliers", value: data?.realEstate, detail: `${data?.land ?? "—"} terrains`, icon: ClipboardList },
  ];

  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#92703e]">Espace de gestion</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#174c38] sm:text-3xl">Vue générale</h1><p className="mt-2 text-sm leading-6 text-[#52655b]">Retrouvez les indicateurs et les activités disponibles pour votre équipe.</p></div>

    {canDashboard && <section aria-labelledby="indicators-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><h2 id="indicators-title" className="text-lg font-semibold text-[#174c38]">Indicateurs clés</h2><p className="text-xs text-[#52655b]">Données enregistrées · maximum 1 000 lignes par catégorie</p></div>
      {stats.status === "loading" && <p role="status" className="mb-3 text-sm text-[#52655b]">Chargement des indicateurs…</p>}
      {stats.status === "error" && <p role="alert" className="mb-3 rounded-xl bg-[#fbf0ee] p-4 text-sm text-[#8d3c32]">Indicateurs indisponibles : {stats.message}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, detail, icon: Icon }) => <article key={label} className="rounded-2xl border border-[#e7e0d4] bg-white p-5"><div className="flex items-start justify-between gap-3"><h3 className="text-sm text-[#52655b]">{label}</h3><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf4ee] text-[#174c38]"><Icon size={18} aria-hidden="true"/></span></div><p className="mt-4 text-3xl font-semibold text-[#174c38]">{value ?? "—"}</p><p className="mt-2 text-xs text-[#52655b]">{data ? detail : "Donnée indisponible"}</p></article>)}</div>
    </section>}

    <section className="grid gap-4 xl:grid-cols-2" aria-label="Activité récente et à venir">
      {canLeads && <article className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e0d4] bg-white"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-base font-semibold text-[#174c38]">Prospects récents</h2><p className="mt-1 text-xs text-[#52655b]">Les cinq derniers contacts enregistrés</p></div><Link href="/admin/crm" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[#174c38]">Ouvrir les prospects <ArrowRight size={14} aria-hidden="true"/></Link></div>
        {leads.status === "loading" ? <p role="status" className="p-5 text-sm text-[#52655b]">Chargement des prospects…</p> : leads.status === "error" ? <p role="alert" className="m-5 rounded-lg bg-[#fbf0ee] p-3 text-sm text-[#8d3c32]">Prospects indisponibles : {leads.message}</p> : leads.data.length === 0 ? <p className="p-5 text-sm text-[#52655b]">Aucun prospect enregistré.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[400px] text-left text-xs"><thead className="border-y border-[#eee8dc] bg-[#faf8f3] text-[#52655b]"><tr><th scope="col" className="px-5 py-3">Contact</th><th scope="col" className="px-4 py-3">Intérêt</th><th scope="col" className="px-4 py-3">Étape</th></tr></thead><tbody>{leads.data.map((lead) => <tr key={lead.id} className="border-b border-[#f1ede5] last:border-0"><td className="px-5 py-4 font-semibold text-[#263238]">{lead.full_name}</td><td className="px-4 py-4 text-[#52655b]">{lead.interest}</td><td className="px-4 py-4 text-[#52655b]">{lead.pipeline_stage}</td></tr>)}</tbody></table></div>}
      </article>}
      {canAppointments && <article className="rounded-2xl border border-[#e7e0d4] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-[#174c38]">Rendez-vous à venir</h2><p className="mt-1 text-xs text-[#52655b]">30 prochains jours · heure du Sénégal</p></div><Link href="/admin/agenda" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[#174c38]">Ouvrir l’agenda <ArrowRight size={14} aria-hidden="true"/></Link></div>
        {appointments.status === "loading" ? <p role="status" className="mt-4 text-sm text-[#52655b]">Chargement des rendez-vous…</p> : appointments.status === "error" ? <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] p-3 text-sm text-[#8d3c32]">Rendez-vous indisponibles : {appointments.message}</p> : appointments.data.length === 0 ? <p className="mt-4 text-sm text-[#52655b]">Aucun rendez-vous dans les 30 prochains jours.</p> : <ul className="mt-4 space-y-2">{appointments.data.map((appointment) => <li key={appointment.id} className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-[#faf8f3] px-4 py-3 text-xs"><time dateTime={appointment.starts_at} className="font-bold text-[#174c38]">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Dakar" }).format(new Date(appointment.starts_at))}</time><span><strong className="block text-[#263238]">{appointment.purpose}</strong><span className="mt-1 block text-[#52655b]">{appointment.contact_name} · {appointment.status}</span></span></li>)}</ul>}
      </article>}
    </section>

    <section className="rounded-2xl border border-[#e7e0d4] bg-white p-5"><h2 className="text-base font-semibold text-[#174c38]">Accès rapides</h2><div className="mt-4 flex flex-wrap gap-3">
      {canProperties && <Link href="/admin/biens" className="inline-flex min-h-11 items-center rounded-lg border border-[#d7e3d8] px-4 text-xs font-semibold text-[#174c38]">Gérer les annonces</Link>}
      {canLeads && <Link href="/admin/crm" className="inline-flex min-h-11 items-center rounded-lg border border-[#d7e3d8] px-4 text-xs font-semibold text-[#174c38]">Suivre les prospects</Link>}
      {canAppointments && <Link href="/admin/agenda" className="inline-flex min-h-11 items-center rounded-lg border border-[#d7e3d8] px-4 text-xs font-semibold text-[#174c38]">Ouvrir les rendez-vous</Link>}
    </div><p className="mt-4 text-xs leading-5 text-[#52655b]">Documents et fiche SIG : depuis une annonce, selon les droits et l’activation. Transactions, réclamations, rapports et paramètres : modules dédiés à développer.</p></section>
  </div>;
}
