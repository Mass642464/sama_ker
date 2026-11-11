import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MobileAppNav } from "@/components/mobile-app-nav";

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="site-frame"><SiteHeader /><main>{children}</main><SiteFooter /><MobileAppNav /></div>;
}