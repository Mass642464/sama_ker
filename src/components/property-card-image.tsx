"use client";

import Image from "next/image";
import { useState } from "react";
import type { PropertyPhoto } from "@/lib/properties";

export function PropertyCardImage({ photo, isDemo }: { photo?: PropertyPhoto; isDemo: boolean }) {
  const [unavailable, setUnavailable] = useState(false);
  const label = !photo ? "Photo non fournie" : unavailable ? "Photo indisponible" : isDemo ? "Illustration · bien non représenté" : "Média publié";
  return <>
    {photo && !unavailable && <Image src={photo.src} alt={photo.alt} fill unoptimized={!isDemo} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" onError={() => setUnavailable(true)} className="object-cover"/>}
    <span className="absolute bottom-3 right-3 rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#263238]">{label}</span>
  </>;
}
