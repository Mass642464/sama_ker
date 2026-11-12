"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { clientApi } from "@/lib/client-api";

type WorkPhoto = { id: string; name: string; url: string };
type WorkUpdate = { id: string; phase_index: number; body: string; published_at: string | null; photos: WorkPhoto[] };
type WorkPhase = { phase_index: number; title: string; status: "pending" | "in_progress" | "completed"; updated_at: string };
type WorkProject = { id: string; title: string; description: string; progress: number; phases: WorkPhase[]; updates: WorkUpdate[] };

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date indisponible" : new Intl.DateTimeFormat("fr-SN", {
    dateStyle: "long", timeZone: "Africa/Dakar",
  }).format(date);
}

export function ClientConstructionWork() {
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    clientApi<{ projects: WorkProject[] }>("/api/client/construction")
      .then((result) => { if (active) setProjects(result.projects); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Les chantiers n’ont pas pu être chargés."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <section className="space-y-6">
    <div>
      <p className="eyebrow">Suivi de chantier</p>
      <h2 className="mt-2 text-2xl font-semibold text-[#18371d]">Mes travaux</h2>
      <p className="mt-2 text-sm leading-6 text-[#66766c]">Consultez les phases et les mises à jour publiées par l’équipe. Les brouillons ne sont pas visibles ici.</p>
    </div>
    {error && <p role="alert" className="rounded-xl bg-[#fbf0ee] p-4 text-sm text-[#8d3c32]">{error}</p>}
    {loading && <p role="status" className="text-sm text-[#718078]">Chargement des chantiers…</p>}
    {!loading && !error && projects.length === 0 && <p className="rounded-2xl border border-[#e6e0d5] bg-white p-5 text-sm text-[#718078]">Aucun chantier n’est encore rattaché à votre espace.</p>}

    {projects.map((project) => <article key={project.id} className="overflow-hidden rounded-2xl border border-[#e6e0d5] bg-white">
      <header className="border-b border-[#edf0ed] p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60856c]">Chantier</p>
        <h3 className="mt-2 text-xl font-semibold text-[#18371d]">{project.title}</h3>
        {project.description && <p className="mt-2 text-sm leading-6 text-[#66766c]">{project.description}</p>}
        <div className="mt-5 flex items-center justify-between gap-4 text-xs font-semibold text-[#52655b]"><span>Avancement indicatif</span><span>{project.progress}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf0ed]" role="progressbar" aria-label={`Avancement de ${project.title}`} aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[#5b8c63]" style={{ width: `${project.progress}%` }}/>
        </div>
      </header>

      <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <h4 className="font-semibold text-[#18371d]">Phases du chantier</h4>
          <ol className="mt-4 space-y-3">
            {project.phases.map((phase) => <li key={phase.phase_index} className="flex items-start gap-3 text-sm">
              <span aria-hidden="true" className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${phase.status === "completed" ? "bg-[#dcebdc] text-[#174c38]" : phase.status === "in_progress" ? "bg-[#f3ead5] text-[#805d1f]" : "bg-[#f0f2f0] text-[#89948d]"}`}>{phase.status === "completed" ? "✓" : phase.phase_index + 1}</span>
              <span className="min-w-0"><span className="block font-medium text-[#344b3f]">{phase.title}</span><span className="mt-0.5 block text-xs text-[#89948d]">{phase.status === "completed" ? "Terminée" : phase.status === "in_progress" ? "En cours" : "À venir"}</span></span>
            </li>)}
          </ol>
        </div>

        <div>
          <h4 className="font-semibold text-[#18371d]">Journal des mises à jour</h4>
          {project.updates.length === 0 ? <p className="mt-3 text-sm text-[#718078]">Aucune mise à jour publiée pour le moment.</p> :
            <ol className="mt-4 space-y-5 border-l border-[#dce6dc] pl-4">
              {project.updates.map((update) => <li key={update.id} className="relative">
                <span aria-hidden="true" className="absolute -left-[21px] top-1 size-3 rounded-full border-2 border-white bg-[#5b8c63]"/>
                <p className="text-xs font-semibold text-[#60856c]">{project.phases.find((phase) => phase.phase_index === update.phase_index)?.title ?? "Étape du chantier"}</p>
                <p className="mt-1 text-[11px] text-[#89948d]">{update.published_at ? dateLabel(update.published_at) : ""}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#52655b]">{update.body}</p>
                {update.photos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{update.photos.map((photo) => <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-[#e6e0d5] bg-[#f5f1e8]">
                  <Image src={photo.url} alt={`Photo du chantier : ${photo.name}`} width={800} height={600} unoptimized className="aspect-[4/3] w-full object-cover"/>
                  <span className="block truncate px-2 py-1.5 text-[10px] text-[#66766c]">{photo.name}</span>
                </a>)}</div>}
              </li>)}
            </ol>}
        </div>
      </div>
    </article>)}
  </section>;
}
