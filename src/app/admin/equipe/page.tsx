"use client";

import { useEffect, useState, type FormEvent } from "react";
import { UserCog } from "lucide-react";
import { adminApi, type StaffMember, type StaffRoster } from "@/lib/admin-api";
import { useAdminSession } from "@/components/admin-session";

const roleHelp: Record<string, string> = {
  admin: "Biens, prospects, agenda, équipe et journal. Ne valide pas les annonces.",
  responsable: "Contrôle et publie les annonces ; lecture des prospects et de l’agenda.",
  commercial: "Prospects et agenda en écriture ; biens en lecture.",
  technique: "Biens en écriture ; aucun accès aux prospects.",
  direction: "Lecture seule des biens, prospects, agenda et journal.",
  responsable_travaux: "Création et suivi des seuls chantiers qui lui sont affectés.",
};

export default function AdminTeamPage() {
  const { can } = useAdminSession();
  const allowed = can("staff:manage");
  const [roster, setRoster] = useState<StaffRoster | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setRoster(await adminApi<StaffRoster>("/api/admin/staff"));
  }

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    adminApi<StaffRoster>("/api/admin/staff")
      .then((result) => { if (active) setRoster(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "L’équipe n’a pas pu être chargée."); });
    return () => { active = false; };
  }, [allowed]);

  async function save(member: Pick<StaffMember, "email" | "role" | "active">) {
    setError("");
    setSaving(true);
    try {
      await adminApi("/api/admin/staff", { method: "PUT", body: JSON.stringify(member) });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La modification n’a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await save({ email: String(data.get("email") ?? ""), role: String(data.get("role") ?? ""), active: true });
    form.reset();
  }

  if (!allowed) return <p role="alert" className="rounded-xl bg-[#f8f2e8] p-5 text-sm text-[#775d34]">Votre rôle ne donne pas accès à la gestion de l’équipe.</p>;

  return <div>
    <p className="text-xs font-bold uppercase tracking-[.16em] text-[#3d7759]">Administration</p>
    <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-[#18371d] sm:text-3xl"><UserCog size={24}/>Équipe et rôles</h1>
    <p className="mt-2 max-w-2xl text-xs leading-5 text-[#56605a]">Chaque personne doit déjà avoir un compte avec une adresse confirmée. Le rôle est vérifié par le serveur à chaque action, et chaque modification est consignée dans le journal d’audit.</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] p-3 text-xs text-[#8d3c32]">{error}</p>}

    <form onSubmit={add} className="mt-6 grid gap-3 rounded-2xl border border-[#e6ebe6] bg-white p-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
      <label className="text-xs font-semibold text-[#52655b]">Adresse e-mail<input name="email" type="email" required maxLength={254} className="admin-field"/></label>
      <label className="text-xs font-semibold text-[#52655b]">Rôle<select name="role" defaultValue="commercial" className="admin-field">{roster?.roles.map((item) => <option key={item.role} value={item.role}>{item.label}</option>)}</select></label>
      <button disabled={saving || !roster} className="h-11 rounded-lg bg-[#32743d] px-5 text-xs font-bold text-white disabled:opacity-60">Ajouter / mettre à jour</button>
    </form>

    <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e6ebe6] bg-white">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="border-b border-[#edf0ed] text-xs uppercase tracking-wider text-[#56605a]"><tr><th className="px-4 py-3">Adresse</th><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">État</th><th className="px-4 py-3"><span className="sr-only">Action</span></th></tr></thead>
        <tbody>
          {roster?.bootstrap.map((member) => <tr key={member.email} className="border-b border-[#f0f2f0]"><td className="px-4 py-3 font-semibold">{member.email}</td><td className="px-4 py-3">Administrateur</td><td className="px-4 py-3 text-[#3d7759]">Actif</td><td className="px-4 py-3 text-[#56605a]">Géré par la configuration du serveur</td></tr>)}
          {roster?.members.map((member) => <tr key={member.email} className="border-b border-[#f0f2f0] last:border-0">
            <td className="px-4 py-3 font-semibold">{member.email}</td>
            <td className="px-4 py-3"><select aria-label={`Rôle de ${member.email}`} value={member.role} disabled={saving} onChange={(event) => void save({ ...member, role: event.target.value })} className="rounded-lg border border-[#e5eae5] bg-white px-2 py-1.5">{roster.roles.map((item) => <option key={item.role} value={item.role}>{item.label}</option>)}</select><span className="mt-1 block max-w-xs text-[11px] text-[#56605a]">{roleHelp[member.role]}</span></td>
            <td className={`px-4 py-3 ${member.active ? "text-[#3d7759]" : "text-[#946447]"}`}>{member.active ? "Actif" : "Désactivé"}</td>
            <td className="px-4 py-3"><button type="button" disabled={saving} onClick={() => void save({ ...member, active: !member.active })} className="rounded-lg border border-[#e5eae5] px-3 py-1.5 font-semibold">{member.active ? "Désactiver" : "Réactiver"}</button></td>
          </tr>)}
          {roster && roster.members.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-[#56605a]">Aucun membre ajouté en dehors des administrateurs d’amorçage.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
