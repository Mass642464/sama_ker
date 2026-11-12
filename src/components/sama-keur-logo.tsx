import Image from "next/image";

export function SamaKeurLogo({ className = "w-36 sm:w-40", loading = "eager" }: { className?: string; loading?: "eager" | "lazy" }) {
  return <Image src="/images/sama-ker-logo-trim.png" alt="" width={1631} height={544} sizes="(max-width: 639px) 144px, 160px" loading={loading} className={`h-auto ${className}`}/>;
}
