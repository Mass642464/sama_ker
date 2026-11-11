"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, CircleHelp, Command, History, House, LayoutDashboard, LogOut, MapPinned, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { signOut } from "@/app/connexion-admin/actions";
import { adminApi, type AdminPermission, type AdminSession } from "@/lib/admin-api";
import { AdminSessionProvider } from "@/components/admin-session";

const navigation: { href: string; label: string; icon: typeof House; permission: AdminPermission }[] = [
  { href: "/admin", label: "Vue d’ensemble", icon: LayoutDashboard, permission: "dashboard:read" },
  { href: "/admin/biens", label: "Gestion des biens", icon: MapPinned, permission: "properties:read" },
  { href: "/admin/crm", label: "Prospects & CRM", icon: UsersRound, permission: "leads:read" },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, permission: "appointments:read" },
  { href: "/admin/equipe", label: "Équipe et rôles", icon: UserCog, permission: "staff:manage" },
  { href: "/admin/audit", label: "Journal d’audit", icon: History, permission: "audit:read" },
];

function Screen({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-5">{children}</main>;
}

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [error, setError] = useState<{ message: string } | null>(null);

  useEffect(() => {
    let active = true;
    adminApi<AdminSession>("/api/admin/session")
      .then((result) => { if (active) setSession(result); })
      .catch((reason: unknown) => { if (active) setError({ message: reason instanceof Error ? reason.message : "La session n’a pas pu être vérifiée." }); });
    return () => { active = false; };
  }, []);

  if (error) {
    return <Screen><div role="alert" className="max-w-lg rounded-xl bg-[#f8f2e8] p-5 text-sm leading-6 text-[#775d34]">
      <p>{error.message === "Compte non autorisé." ? "Ce compte n’appartient pas à l’équipe. Demandez à un administrateur de vous attribuer un rôle." : error.message}</p>
      <form action={signOut} className="mt-4"><button className="rounded-lg border border-[#d9c9a8] px-4 py-2 text-xs font-bold">Se déconnecter</button></form>
    </div></Screen>;
  }
  if (!session) return <Screen><p role="status" className="text-sm text-[#718078]">Vérification de votre accès…</p></Screen>;

  const items = navigation.filter((item) => session.permissions.includes(item.permission));

  return <AdminSessionProvider value={session}>
    <div className="min-h-screen bg-[#f5f7f5] text-[#18371d] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden min-h-screen flex-col border-r border-[#e6ebe6] bg-white px-4 py-5 lg:flex">
        <Link href="/admin" className="flex items-center gap-3 px-2"><span className="grid size-10 place-items-center rounded-xl bg-[#e8eee5] text-[#315c3a]"><House size={19}/></span><span><strong className="block text-[11px] tracking-wide">ESPACE SAMA KËR</strong><span className="mt-1 block text-[10px] uppercase tracking-[.12em] text-[#849188]">Administration</span></span></Link>
        <div className="mt-8 rounded-xl border border-[#dce9dd] bg-[#f3f7f2] p-3"><div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-[#3d7759]"><ShieldCheck size={14}/> Accès protégé</div><p className="mt-1.5 text-[11px] leading-4 text-[#617169]">{session.roleLabel} · actions enregistrées</p></div>
        <p className="mb-3 mt-8 px-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#9aa59e]">Espace de travail</p>
        <nav className="space-y-1" aria-label="Navigation administration">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold text-[#617169] transition hover:bg-[#f1f5f0] hover:text-[#18371d]"><Icon size={16}/>{label}</Link>)}</nav>
        <div className="mt-auto border-t border-[#edf0ed] pt-4"><Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold text-[#617169] hover:bg-[#f1f5f0]"><House size={15}/>Retour au site public</Link><div className="mt-2 flex items-center gap-3 rounded-xl bg-[#f7f8f5] p-3"><span className="grid size-8 place-items-center rounded-full bg-[#dce8df] text-[10px] font-bold text-[#41694b]">{email.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{email}</strong><span className="mt-0.5 block text-[10px] text-[#849188]">{session.roleLabel}</span></span></div><form action={signOut}><button className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold text-[#617169] hover:bg-[#f1f5f0]"><LogOut size={15}/>Se déconnecter</button></form></div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-[#e6ebe6] bg-white/95 backdrop-blur"><div className="flex h-[66px] items-center justify-between gap-4 px-4 sm:px-7"><div className="flex items-center gap-3"><Link href="/admin" className="grid size-9 place-items-center rounded-xl bg-[#18371d] font-bold text-[#b9d4c0] lg:hidden">T.</Link><span className="hidden items-center gap-2 rounded-lg bg-[#f5f7f5] px-3 py-2 text-[11px] text-[#87938c] sm:flex"><Command size={13}/> Espace de gestion</span></div><div className="flex items-center gap-2"><Link href="/contact" className="hidden items-center gap-2 rounded-lg border border-[#e5eae5] px-3 py-2 text-[11px] font-semibold text-[#52655b] sm:flex"><CircleHelp size={14}/> Aide</Link><form action={signOut} className="lg:hidden"><button className="flex items-center gap-1.5 rounded-lg border border-[#e5eae5] px-2.5 py-2 text-[11px] font-semibold text-[#52655b]"><LogOut size={13}/>Quitter</button></form><span className="grid size-8 place-items-center rounded-full bg-[#dce8df] text-[10px] font-bold text-[#41694b]">{email.slice(0, 1).toUpperCase()}</span></div></div><div className="flex gap-1 overflow-x-auto border-t border-[#f0f2f0] px-3 py-2 lg:hidden">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-[#617169] hover:bg-[#f1f5f0]"><Icon size={14}/>{label}</Link>)}</div></header>
        <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-7">{children}</main>
        <footer className="px-7 pb-7 text-center text-[10px] text-[#9aa49e]">Sama Kër · administration</footer>
      </div>
    </div>
  </AdminSessionProvider>;
}
