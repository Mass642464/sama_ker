import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MobileAppNav } from "@/components/mobile-app-nav";
import { FavoritesProvider } from "@/components/favorites-provider";

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="site-frame"><SiteHeader /><FavoritesProvider><main>{children}</main></FavoritesProvider><SiteFooter /><MobileAppNav /></div>;
}