import Link from "next/link";
import { catalogPath } from "@/shared/config";
import { PageHeader } from "@/shared/ui";

export function HomePage() {
  return (
    <>
      <PageHeader title="오늘" />
      {process.env.NODE_ENV === "development" && (
        <Link href={catalogPath} className="text-label text-primary">
          컴포넌트 살펴보기
        </Link>
      )}
    </>
  );
}
