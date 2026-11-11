import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListingFiles } from "@/components/listing-files";

export const metadata: Metadata = {
  title: "Fichiers privés",
  robots: { index: false, follow: false },
};

export default async function ListingFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-3xl">
    <Link href="/admin/biens" className="inline-flex items-center gap-2 text-xs font-semibold text-[#65766d]"><ArrowLeft size={14}/> Retour aux biens</Link>
    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#18371d]">Fichiers privés de l’annonce</h1>
    <p className="mt-1 font-mono text-[10px] text-[#a0a8a2]">{id}</p>
    <div className="mt-6"><ListingFiles listingId={id}/></div>
  </div>;
}
