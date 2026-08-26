import type { Metadata } from "next";
import FuelPortal from "./FuelPortal";

export const metadata: Metadata = {
  title: "Concrete Kings Fuel",
  description: "Tablet-optimized, offline-first attendant portal for vehicle fuel dispensation logging.",
  manifest: "/manifest-fuel.json",
};

export default function Page() {
  return <FuelPortal />;
}
