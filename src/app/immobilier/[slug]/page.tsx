import { PropertyDetailPage } from "@/app/terrains/[slug]/page";

export { generateMetadata } from "@/app/terrains/[slug]/page";

export default function ImmobilierDetailPage({ params }: { params: Promise<{ slug: string }> }) {
	return PropertyDetailPage({ params, category: "immobilier" });
}