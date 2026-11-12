import type { Metadata } from "next";
import { AdminConstructionWork } from "@/components/admin-construction-work";

export const metadata: Metadata = {
  title: "Travaux",
};

export default function AdminConstructionPage() {
  return <AdminConstructionWork/>;
}
