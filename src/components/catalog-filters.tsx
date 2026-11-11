"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

// Sur mobile, les filtres secondaires sont repliés ; ils restent dans le formulaire et sont toujours envoyés.
export function FilterPanel({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(activeCount > 0);
  const panelId = useId();

  return <>
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#e5eae5] bg-white px-4 text-xs font-bold text-[#18371d] sm:hidden">
      <span className="flex items-center gap-2"><SlidersHorizontal size={15}/>Plus de filtres{activeCount > 0 && <span className="rounded-full bg-[#32743d] px-2 py-0.5 text-[10px] text-white">{activeCount}</span>}</span>
      <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`}/>
    </button>
    <div id={panelId} className={open ? "contents" : "hidden sm:contents"}>{children}</div>
  </>;
}
