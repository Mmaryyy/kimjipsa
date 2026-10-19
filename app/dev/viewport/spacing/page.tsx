import { notFound } from "next/navigation";
import { ViewportSpacingPage } from "@/pages/viewport";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <ViewportSpacingPage />;
}
