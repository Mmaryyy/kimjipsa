import Link from "next/link";
import { HomeSchedule } from "./home-schedule";
import { InstallGuide } from "@/shared/pwa";
import { accountRoutes, catalogPath } from "@/shared/config";
import { PageHeader } from "@/shared/ui";

export function HomePage() {
  return (
    <>
      <PageHeader title="오늘" />
      <HomeSchedule />
      <Link href={accountRoutes.family} className="text-primary">
        우리 집·초대 관리하기
      </Link>
      <InstallGuide />
      {process.env.NODE_ENV === "development" && (
        <Link href={catalogPath} className="text-label text-primary">
          컴포넌트 살펴보기
        </Link>
      )}
    </>
  );
}
