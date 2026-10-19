import { Text } from "@/shared/ui";
export function LoginIntroduction() {
  return (
    <div>
      <h1 className="kj-wordmark">김집사</h1>
      <Text as="p" className="mt-2 text-muted-foreground">
        일정, 재고, 장바구니를 둘이 함께 관리하는 우리 집 공간이에요.
      </Text>
      <ul className="kj-onboarding-benefits">
        <li>
          <strong>일정</strong>
          <span>함께 보고, 개인 일정은 나만 보게</span>
        </li>
        <li>
          <strong>재고</strong>
          <span>떨어진 것, 유통기한 임박한 것 한눈에</span>
        </li>
        <li>
          <strong>장바구니</strong>
          <span>마트에서 같이 체크하고 바로 재고에 반영</span>
        </li>
      </ul>
    </div>
  );
}
