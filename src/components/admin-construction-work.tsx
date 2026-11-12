"use client";

import { useEffect, useState, type FormEvent } from "react";
import { adminApi } from "@/lib/admin-api";
import { useAdminSession } from "@/components/admin-session";

type WorkPhoto = { id: string; name: string; url: string };
type WorkUpdate = { id: string; phase_index: number; body: string; status: "draft" | "published"; published_at: string | null; photos: WorkPhoto[] };
type WorkPhase = { phase_index: number; title: string; status: string };
type WorkProject = { id: string; clientEmail: string; assignedTo: string; title: string; description: string; progress: number; phases: WorkPhase[]; updates: WorkUpdate[] };
type WorkResponse = { projects: WorkProject[] };

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date indisponible" : new Intl.DateTimeFormat("fr-SN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Dakar",
  }).format(date);
}

export function AdminConstructionWork() {
  const { session } = useAdminSession();
  const canRead = session.permissions.includes("work:read");
  const canWrite = session.permissions.includes("work:write");
  const canAssign = session.permissions.includes("work:assign");
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const result = await adminApi<WorkResponse>("/api/admin/work/projects");
    setProjects(result.projects);
  }

  useEffect(() => {
    if (!canRead) return;
    let active = true;
    adminApi<WorkResponse>("/api/admin/work/projects")
      .then((result) => { if (active) setProjects(result.projects); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Les chantiers n’ont pas pu être chargés."); });
    return () => { active = false; };
  }, [canRead]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await adminApi("/api/admin/work/projects", {
        method: "POST",
        body: JSON.stringify({
          clientEmail: values.get("clientEmail"),
          title: values.get("title"),
          description: values.get("description"),
          ...(canAssign ? { assignedTo: values.get("assignedTo") } : {}),
        }),
      });
      form.reset();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le chantier n’a pas pu être créé.");
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(event: FormEvent<HTMLFormElement>, project: WorkProject) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await adminApi(`/api/admin/work/projects/${encodeURIComponent(project.id)}/updates`, {
        method: "POST",
        body: JSON.stringify({ phaseIndex: Number(values.get("phaseIndex")), body: values.get("body") }),
      });
      form.reset();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le brouillon n’a pas pu être créé.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhotos(event: FormEvent<HTMLFormElement>, update: WorkUpdate) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("photos") as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);
    if (files.length === 0) {
      setError("Choisissez au moins une photo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const file of files) {
        await adminApi(`/api/admin/work/updates/${encodeURIComponent(update.id)}/photos?name=${encodeURIComponent(file.name)}`, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
      }
      form.reset();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Une photo n’a pas pu être ajoutée.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(update: WorkUpdate) {
    setBusy(true);
    setError("");
    try {
      await adminApi(`/api/admin/work/updates/${encodeURIComponent(update.id)}/publish`, { method: "POST" });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La publication n’a pas abouti.");
    } finally {
      setBusy(false);
    }
  }

  async function savePhase(event: FormEvent<HTMLFormElement>, project: WorkProject) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await adminApi(`/api/admin/work/projects/${encodeURIComponent(project.id)}/phases/${encodeURIComponent(String(values.get("phaseIndex")))}`, {
        method: "PATCH",
        body: JSON.stringify({ status: values.get("status") }),
      });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le statut de phase n’a pas pu être enregistré.");
    } finally {
      setBusy(false);
    }
  }

  if (!canRead) return <p role="alert" className="rounded-xl bg-[#f8f2e8] p-5 text-sm text-[#775d34]">Votre rôle ne donne pas accès au suivi des travaux.</p>;

  return <div className="space-y-7">
    <header>
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60856c]">Espace de gestion</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#18371d] sm:text-3xl">Travaux</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718078]">Les brouillons restent internes. Seules les mises à jour publiées et leurs photos apparaissent dans l’espace du client.</p>
    </header>
    {error && <p role="alert" className="rounded-xl bg-[#fbf0ee] p-4 text-sm text-[#8d3c32]">{error}</p>}

    {canWrite && <form onSubmit={createProject} className="grid gap-3 rounded-2xl border border-[#e6ebe6] bg-white p-5 sm:grid-cols-2">
      <h2 className="sm:col-span-2 text-lg font-semibold text-[#18371d]">Créer un chantier</h2>
      <label className="text-xs font-semibold text-[#52655b]">E-mail confirmé du client<input name="clientEmail" type="email" required maxLength={254} className="admin-field"/></label>
      <label className="text-xs font-semibold text-[#52655b]">Nom du chantier<input name="title" required minLength={3} maxLength={160} className="admin-field"/></label>
      {canAssign && <label className="text-xs font-semibold text-[#52655b]">E-mail du responsable travaux<input name="assignedTo" type="email" required defaultValue={session.email} maxLength={254} className="admin-field"/></label>}
      <label className="text-xs font-semibold text-[#52655b] sm:col-span-2">Description<textarea name="description" rows={3} maxLength={2000} className="admin-field"/></label>
      <p className="text-xs leading-5 text-[#718078] sm:col-span-2">Le client doit déjà disposer d’un compte confirmé. Huit phases standard sont ajoutées automatiquement.</p>
      <button disabled={busy} className="min-h-11 justify-self-start rounded-lg bg-[#174c38] px-5 text-xs font-bold text-white disabled:opacity-60">Créer le chantier</button>
    </form>}

    {projects.length === 0 ? <p className="rounded-2xl border border-[#e6e0d5] bg-white p-5 text-sm text-[#718078]">Aucun chantier à afficher.</p> :
      <div className="space-y-5">{projects.map((project) => <article key={project.id} className="overflow-hidden rounded-2xl border border-[#e6e0d5] bg-white">
        <header className="border-b border-[#edf0ed] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-[#18371d]">{project.title}</h2><p className="mt-1 text-xs text-[#718078]">Client : {project.clientEmail} · Responsable : {project.assignedTo}</p></div>
            <span className="rounded-full bg-[#eaf2e9] px-3 py-1 text-xs font-bold text-[#174c38]">{project.progress}%</span>
          </div>
          {project.description && <p className="mt-3 text-sm leading-6 text-[#66766c]">{project.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2">{project.phases.map((phase) => <span key={phase.phase_index} className={`rounded-full px-3 py-1 text-[11px] ${phase.status === "completed" ? "bg-[#dcebdc] text-[#174c38]" : phase.status === "in_progress" ? "bg-[#f3ead5] text-[#805d1f]" : "bg-[#f0f2f0] text-[#718078]"}`}>{phase.title}</span>)}</div>
          {canWrite && <form onSubmit={(event) => void savePhase(event, project)} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-semibold text-[#52655b]">Phase<select name="phaseIndex" className="admin-field mt-1 min-h-9 py-1">{project.phases.map((phase) => <option key={phase.phase_index} value={phase.phase_index}>{phase.title}</option>)}</select></label>
            <label className="text-[11px] font-semibold text-[#52655b]">Avancement<select name="status" className="admin-field mt-1 min-h-9 py-1"><option value="pending">À venir</option><option value="in_progress">En cours</option><option value="completed">Terminée</option></select></label>
            <button disabled={busy} className="min-h-9 rounded-lg border border-[#d8e2d8] px-3 text-xs font-bold text-[#174c38] disabled:opacity-50">Enregistrer</button>
          </form>}
        </header>

        <div className="grid gap-6 p-5 lg:grid-cols-2">
          {canWrite && <form onSubmit={(event) => void createDraft(event, project)} className="space-y-3 rounded-xl bg-[#f8f7f2] p-4">
            <h3 className="font-semibold text-[#18371d]">Nouvelle mise à jour · brouillon</h3>
            <label className="block text-xs font-semibold text-[#52655b]">Phase<select name="phaseIndex" required defaultValue={project.phases[0]?.phase_index ?? 0} className="admin-field">{project.phases.map((phase) => <option key={phase.phase_index} value={phase.phase_index}>{phase.title}</option>)}</select></label>
            <label className="block text-xs font-semibold text-[#52655b]">Note visible par le client après publication<textarea name="body" required maxLength={2000} rows={3} className="admin-field"/></label>
            <button disabled={busy} className="min-h-10 rounded-lg bg-[#174c38] px-4 text-xs font-bold text-white disabled:opacity-60">Enregistrer le brouillon</button>
          </form>}

          <div className="space-y-4">
            <h3 className="font-semibold text-[#18371d]">Journal des mises à jour</h3>
            {project.updates.length === 0 ? <p className="text-sm text-[#718078]">Aucune mise à jour enregistrée.</p> : project.updates.map((update) => <div key={update.id} className="rounded-xl border border-[#edf0ed] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#60856c]">{project.phases.find((phase) => phase.phase_index === update.phase_index)?.title ?? "Phase"} · {update.status === "draft" ? "Brouillon" : "Publié"}</p>
                <span className="text-[10px] text-[#89948d]">{update.published_at ? dateLabel(update.published_at) : "Non publié"}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#52655b]">{update.body}</p>
              {update.photos.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{update.photos.map((photo) => <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#eaf2e9] px-3 py-2 text-xs font-semibold text-[#174c38]">{photo.name}</a>)}</div>}
              {canWrite && update.status === "draft" && <div className="mt-4 space-y-3 border-t border-[#edf0ed] pt-3">
                <form onSubmit={(event) => void uploadPhotos(event, update)} className="flex flex-wrap items-center gap-2">
                  <input name="photos" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple className="min-w-0 flex-1 text-xs"/>
                  <button disabled={busy} className="rounded-lg border border-[#d8e2d8] px-3 py-2 text-xs font-bold text-[#174c38] disabled:opacity-50">Ajouter photos</button>
                </form>
                <button type="button" disabled={busy} onClick={() => void publish(update)} className="min-h-10 rounded-lg bg-[#c59b52] px-4 text-xs font-bold text-[#263238] disabled:opacity-50">Publier et notifier le client</button>
              </div>}
            </div>)}
          </div>
        </div>
      </article>)}</div>}
  </div>;
}
