import type { Metadata } from "next";
import GateConsole from "./GateConsole";

export const metadata: Metadata = {
  title: "Concrete Kings Central",
  description: "Tablet-optimized, offline-first gate guard attendance and central dispatch console.",
  manifest: "/manifest-gate.json",
};

export default function Page() {
  return <GateConsole />;
}
