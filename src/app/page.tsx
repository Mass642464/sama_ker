import { SamaKeurHome } from "@/components/sama-keur-home";
import { getPublicProperties } from "@/lib/public-properties";

export default async function Home() {
  const properties = await getPublicProperties();
  return <SamaKeurHome properties={properties} />;
}
