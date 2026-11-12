"use client";

import { useWithdrawAccount } from "../../model/use-withdraw-account";
import { useConfirm, Text, TextButton } from "@/shared/ui";

interface Props {
  disabled?: boolean;
}

const WithdrawAccount = ({ disabled = false }: Props) => {
  const confirm = useConfirm();
  const { onWithdraw, pending, reset } = useWithdrawAccount();

  return (
    <>
      <TextButton
        className="mt-2 block"
        data-od-id="s-withdraw"
        tone="danger"
        disabled={disabled || pending}
        onClick={() => {
          reset();
          void confirm({
            title: "김집사에서 탈퇴할까요?",
            description: "삭제한 내용은 되돌릴 수 없어요.",
            confirmLabel: "탈퇴하기",
            onConfirm: onWithdraw,
            children: (
              <div className="mt-3 space-y-3 text-left">
                <div>
                  <Text as="h3" variant="body-sm">
                    삭제되는 것
                  </Text>
                  <ul className="list-disc space-y-1 pl-4 text-caption text-muted-foreground">
                    <li>내 계정과 개인 일정</li>
                    <li>내가 만든 안 쓴 초대 링크</li>
                    <li>내 알림과 푸시 구독</li>
                  </ul>
                </div>
                <div>
                  <Text as="h3" variant="body-sm">
                    가정에 남는 것
                  </Text>
                  <ul className="list-disc space-y-1 pl-4 text-caption text-muted-foreground">
                    <li>공유 일정, 재고, 장바구니는 가정에 남아요.</li>
                    <li>내가 만든 공유 항목은 ‘탈퇴한 사용자’로 표시돼요.</li>
                  </ul>
                </div>
                <Text
                  as="p"
                  variant="caption"
                  className="text-muted-foreground"
                >
                  다른 구성원이 있으면 관리자가 남아 있어야 탈퇴할 수 있어요.
                  마지막 구성원이 탈퇴하면 가정 데이터도 모두 삭제돼요.
                </Text>
              </div>
            ),
          });
        }}
      >
        탈퇴하기
      </TextButton>
    </>
  );
};

export default WithdrawAccount;
