import Image from "next/image";
import { cn } from "@/shared/lib";
import { Text } from "@/shared/ui";

// P2에서 연결할 때 스플래시가 가리는 콘텐츠는 탭 순서와 스크린 리더에서 제외해야 해요.
export function SplashScreen({ className }: { className?: string }) {
  return (
    <div
      className={cn("kj-splash-screen", className)}
      role="status"
      aria-label="김집사를 준비하고 있어요"
    >
      <div>
        <Image
          src="/images/kimjipsa-dog-bird.png"
          alt="강아지 집사와 어깨 위 노란 새"
          width={180}
          height={180}
          priority
        />
        <Text as="p" variant="display">
          김집사
        </Text>
      </div>
    </div>
  );
}
