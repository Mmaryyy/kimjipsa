import Link from "next/link";
import { EmptyState, PageHeader } from "@/shared/ui";

export default function NotFound() {
  return (
    <>
      <PageHeader title="페이지를 찾을 수 없어요" />
      <EmptyState
        message="주소를 다시 확인해 주세요"
        action={
          <Link href="/" className="text-label text-primary">
            홈으로 돌아가기
          </Link>
        }
      />
    </>
  );
}
