import Image from "next/image";

export function BrandLogo() {
  return (
    <div className="text-center" data-od-id="splash-brand">
      <Image
        className="mx-auto mb-6 object-contain"
        src="/images/kimjipsa-dog-bird.png"
        alt="팔에 흰 수건을 걸친 강아지 집사와 어깨 위 작은 노란 새"
        width={180}
        height={180}
        priority
        data-od-id="splash-character"
      />
      <h1 className="kj-wordmark" data-od-id="splash-wordmark">
        김집사
      </h1>
    </div>
  );
}
