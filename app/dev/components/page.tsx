import { SplashScreen } from "@/app/ui";
import { ComponentCatalogPage } from "@/pages/component-catalog";

export default function Page() {
  return (
    <ComponentCatalogPage
      splash={<SplashScreen className="relative min-h-80" />}
    />
  );
}
