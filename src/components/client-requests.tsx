"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { fetchClientRequests } from "@/lib/client-api";
import { appointmentStatusLabels, requestStatusSteps, type ClientRequest } from "@/lib/client-space";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

function formatDate(value: string | null) {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? dateFormatter.format(timestamp) : "Date inconnue";
}

function RequestCard({ request }: { request: ClientRequest }) {
  const currentIndex = requestStatusSteps.findIndex((step) => step.status === request.status);
  const closed = request.status === "closed";
  const current = requestStatusSteps[currentIndex];

  return <li className="rounded-2xl border border-[#e5e9e3] bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-[#18371d]">{request.title}</h3>
        <p className="mt-1 text-[11px] text-[#56605a]">Envoyée le {formatDate(request.createdAt)}</p>
      </div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${closed ? "bg-[#f0eee8] text-[#6f6a58]" : "bg-[#edf4ee] text-[#3d7759]"}`}>{closed ? "Clôturée" : current?.label}</span>
    </div>
    {request.message && <p className="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-6 text-[#596b61]">{request.message}</p>}
    {!closed && current && <>
      <ol className="mt-5 grid grid-cols-4 gap-1.5" aria-label="Avancement de la demande">
        {requestStatusSteps.map((step, index) => <li key={step.status} aria-current={index === currentIndex ? "step" : undefined}>
          <span className={`block h-1.5 rounded-full ${index <= currentIndex ? "bg-[#32743d]" : "bg-[#e5e9e3]"}`}/>
          <span className={`mt-2 block text-xs leading-4 ${index === currentIndex ? "font-bold text-[#18371d]" : "text-[#56605a]"}`}>{step.label}</span>
        </li>)}
      </ol>
      <p className="mt-3 text-xs leading-5 text-[#56605a]">{current.description}</p>
    </>}
    {request.appointments.length > 0 && <div className="mt-5 space-y-2 border-t border-[#edf0eb] pt-4">
      {request.appointments.map((appointment) => <p key={appointment.id} className="flex items-start gap-2 text-xs leading-5 text-[#43584e]">
        <CalendarClock size={15} className="mt-0.5 shrink-0 text-[#3d7759]"/>
        <span>Rendez-vous le {formatDate(appointment.startsAt)} — {appointmentStatusLabels[appointment.status] ?? appointment.status}</span>
      </p>)}
    </div>}
  </li>;
}

export function ClientRequests() {
  const [requests, setRequests] = useState<ClientRequest[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRequests(await fetchClientRequests());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vos demandes n’ont pas pu être chargées.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Le chargement initial démarre après le montage : il dépend de la session stockée dans le navigateur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return <div>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-[#18371d]">Mes demandes</h2>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-[#dfe6df] px-4 py-2 text-xs font-bold text-[#18371d] disabled:opacity-60">
        {loading ? <LoaderCircle size={14} className="animate-spin"/> : <RefreshCw size={14}/>}Actualiser
      </button>
    </div>
    <div aria-live="polite" className="mt-4">
      {error && <p role="alert" className="rounded-xl bg-[#fbf0ee] px-4 py-3 text-xs leading-5 text-[#8d3c32]">{error}</p>}
      {!error && loading && !requests && <p className="text-sm text-[#56605a]">Chargement de vos demandes…</p>}
      {!error && requests && requests.length === 0 && <p className="flex items-start gap-2 rounded-xl bg-[#f0f3ec] px-4 py-4 text-sm leading-6 text-[#596b61]"><CheckCircle2 size={16} className="mt-1 shrink-0 text-[#548365]"/>Vous n’avez pas encore de demande liée à ce compte. Utilisez le formulaire ci-dessous ou le bouton « Demander des informations » d’une fiche de bien.</p>}
      {requests && requests.length > 0 && <ul className="space-y-4">{requests.map((request) => <RequestCard key={request.id} request={request}/>)}</ul>}
    </div>
  </div>;
}
