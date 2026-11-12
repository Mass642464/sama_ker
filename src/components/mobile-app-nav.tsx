"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Compass, House, Map, Wrench } from "lucide-react";

const links = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/terrains", label: "Parcelle", icon: Compass },
  { href: "/immobilier", label: "Immobilier", icon: Building2 },
  { href: "/services", label: "Services", icon: Wrench },
  { href: "/carte", label: "Carte", icon: Map },
] as const;

export function MobileAppNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-app-nav" aria-label="Navigation principale mobile">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`mobile-app-nav__link${active ? " mobile-app-nav__link--active" : ""}`}
          >
            <Icon size={18} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true"/>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
