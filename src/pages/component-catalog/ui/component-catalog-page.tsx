import type { ReactNode } from "react";
import { PageLayout } from "@/shared/ui";
import { notFound } from "next/navigation";
import { ComponentCatalogPreview } from "./component-catalog-preview";

export function ComponentCatalogPage({ splash }: { splash: ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <PageLayout width="wide" header={{ title: "컴포넌트" }}>
      <ComponentCatalogPreview splash={splash} />
    </PageLayout>
  );
}
