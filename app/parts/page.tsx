import type { Metadata } from "next";
import PartsPortal from "./PartsPortal";

export const metadata: Metadata = {
  title: "Concrete Kings Parts",
  description: "Offline-first parts and inventory management portal for Concrete Kings yard operations.",
  manifest: "/manifest-parts.json",
};

export default function Page() {
  return <PartsPortal />;
}
