"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CircleHelp, Command, History, House, LayoutDashboard, LogOut, MapPinned, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { signOut } from "@/app/connexion-admin/actions";
import { adminApi, type AdminPermission, type AdminSession } from "@/lib/admin-api";
import { AdminSessionProvider } from "@/components/admin-session";
import { SamaKeurLogo } from "@/components/sama-keur-logo";

const navigation: { href: string; label: string; icon: typeof House; permission: AdminPermission }[] = [
  { href: "/admin", label: "Vue générale", icon: LayoutDashboard, permission: "dashboard:read" },
  { href: "/admin/biens", label: "Annonces", icon: MapPinned, permission: "properties:read" },
  { href: "/admin/crm", label: "Prospects", icon: UsersRound, permission: "leads:read" },
  { href: "/admin/agenda", label: "Rendez-vous", icon: CalendarDays, permission: "appointments:read" },
  { href: "/admin/equipe", label: "Équipe et rôles", icon: UserCog, permission: "staff:manage" },
  { href: "/admin/audit", label: "Journal d’audit", icon: History, permission: "audit:read" },
];

function Screen({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-5">{children}</main>;
}

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
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
  const isActive = (href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));

  return <AdminSessionProvider value={session}>
    <div className="min-h-screen bg-[#f5f1e8] text-[#263238] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen flex-col bg-[#183a2e] px-4 py-5 text-white lg:flex">
        <Link href="/admin" aria-label="Sama Kër — administration" className="block px-2"><span className="inline-block rounded-xl bg-white px-3 py-2"><SamaKeurLogo/></span><span className="mt-3 block text-[10px] uppercase tracking-[.12em] text-[#c5d6c9]">Espace de gestion</span></Link>
        <div className="mt-7 rounded-xl border border-white/15 bg-white/5 p-3"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#e2c893]"><ShieldCheck size={14}/> Accès protégé</div><p className="mt-1.5 text-xs leading-5 text-[#d3e1d5]">{session.roleLabel}</p></div>
        <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#b3c9b8]">Espace de travail</p>
        <nav className="space-y-1" aria-label="Navigation administration">{items.map(({ href, label, icon: Icon }) =>
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${isActive(href) ? "bg-[#f5f1e8] text-[#174c38]" : "text-[#e2ebe3] hover:bg-white/10"}`}><Icon size={17} aria-hidden="true"/>{label}</Link>
        )}</nav>
        <div className="mt-7 border-t border-white/15 px-3 pt-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#b3c9b8]">Modules dédiés à développer</p><p className="mt-3 text-xs leading-6 text-[#d3e1d5]">Transactions · Réclamations · Rapports · Paramètres</p><p className="mt-2 text-xs leading-5 text-[#d3e1d5]">Documents et SIG sont accessibles depuis les fiches des biens, selon leur activation.</p></div>
        <div className="mt-auto border-t border-white/15 pt-4"><Link href="/" className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold text-[#e2ebe3] hover:bg-white/10"><House size={15}/>Retour au site public</Link><div className="mt-2 flex items-center gap-3 rounded-xl bg-white/10 p-3"><span className="grid size-8 place-items-center rounded-full bg-[#dce8df] text-[10px] font-bold text-[#41694b]">{email.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{email}</strong><span className="mt-0.5 block text-[10px] text-[#c5d6c9]">{session.roleLabel}</span></span></div><form action={signOut}><button className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold text-[#e2ebe3] hover:bg-white/10"><LogOut size={15}/>Se déconnecter</button></form></div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-[#e6e0d5] bg-white/95 backdrop-blur">
          <div className="flex min-h-[66px] items-center justify-between gap-4 px-4 sm:px-7">
            <div className="flex items-center gap-3"><Link href="/admin" aria-label="Sama Kër — administration" className="lg:hidden"><SamaKeurLogo className="w-28 sm:w-32"/></Link><span className="hidden items-center gap-2 rounded-lg bg-[#f5f1e8] px-3 py-2 text-xs text-[#52655b] sm:flex"><Command size={14}/> Espace de gestion</span></div>
            <div className="flex items-center gap-2"><Link href="/contact" className="hidden items-center gap-2 rounded-lg border border-[#e5eae5] px-3 py-2 text-xs font-semibold text-[#52655b] sm:flex"><CircleHelp size={14}/> Contact</Link><form action={signOut} className="lg:hidden"><button className="flex min-h-11 items-center gap-1.5 rounded-lg border border-[#e5eae5] px-2.5 text-xs font-semibold text-[#52655b]"><LogOut size={14}/>Quitter</button></form><span aria-label={`Rôle : ${session.roleLabel}`} className="grid size-8 place-items-center rounded-full bg-[#dce8df] text-[10px] font-bold text-[#41694b]">{email.slice(0, 1).toUpperCase()}</span></div>
          </div>
          <nav aria-label="Navigation administration mobile" className="flex gap-1 overflow-x-auto border-t border-[#f0f2f0] px-3 py-2 lg:hidden">{items.map(({ href, label, icon: Icon }) =>
            <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${isActive(href) ? "bg-[#eaf2e9] text-[#174c38]" : "text-[#52655b] hover:bg-[#f1f5f0]"}`}><Icon size={15} aria-hidden="true"/>{label}</Link>
          )}</nav>
        </header>
        <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-7">{children}</main>
        <footer className="px-7 pb-7 text-center text-xs text-[#66766c]">Sama Kër · administration</footer>
      </div>
    </div>
  </AdminSessionProvider>;
}
