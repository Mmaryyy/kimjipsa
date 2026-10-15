import { PageHeader } from "@/shared/ui";

// 데이터 화면은 각 후속 Phase에서 구현해요.
export function ComingSoonPage({ title }: { title: string }) {
  return <PageHeader title={title} />;
}
