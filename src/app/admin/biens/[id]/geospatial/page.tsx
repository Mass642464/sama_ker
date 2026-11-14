import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GeospatialProfile } from "@/components/geospatial-profile";

export const metadata: Metadata = { title: "Fiche géospatiale", robots: { index: false, follow: false } };

export default async function GeospatialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-4xl">
    <Link href="/admin/biens" className="inline-flex items-center gap-2 text-xs font-semibold text-[#65766d]"><ArrowLeft size={14}/> Retour aux biens</Link>
    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#18371d]">Fiche géospatiale du terrain</h1>
    <p className="mt-1 break-all font-mono text-xs text-[#56605a]">{id}</p>
    <div className="mt-6"><GeospatialProfile listingId={id}/></div>
  </div>;
}
