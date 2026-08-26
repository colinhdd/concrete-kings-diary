import { Metadata } from "next";
import BatchingPortal from "./BatchingPortal";

export const metadata: Metadata = {
  title: "Batching Diary | Concrete Kings",
  description: "Offline-first tablet batching diary for Concrete Kings plant operators.",
};

export default function BatchingPage() {
  return <BatchingPortal />;
}
