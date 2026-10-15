import { ThemeModeSelector, SectionHeader, PageHeader } from "@/shared/ui";
export function AppearanceSettingsPage() {
  return (
    <>
      <PageHeader title="설정" />
      <section>
        <SectionHeader title="화면 모드" />
        <ThemeModeSelector />
      </section>
    </>
  );
}
