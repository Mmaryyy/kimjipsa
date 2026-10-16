import { Banner, Text } from "@/shared/ui";
import type { LegalDocumentKind } from "../model/legal-document.constants";

export function LegalDocumentContent({ kind }: { kind: LegalDocumentKind }) {
  const privacy = kind === "privacy";
  return (
    <div className="grid gap-5">
      <Banner title="개발용 초안이에요" variant="warning">
        법률 검토를 거친 문서가 아니에요. 정식 문서는 베타 전에 안내해요.
      </Banner>
      {privacy ? (
        <>
          <Text as="h2" variant="title-sm">
            수집 항목과 목적
          </Text>
          <Text as="p">
            로그인 수단과 해당 수단의 사용자 식별자, 표시 이름, 가정 이름과
            구성원·초대 정보를 계정 식별과 공동 가정 관리에 사용해요. 이메일은
            계정 식별·연결에 사용하지 않으며 카카오에서는 수집하지 않아요.
          </Text>
          <Text as="h2" variant="title-sm">
            처리와 보관
          </Text>
          <Text as="p">
            인증과 데이터 저장에는 Supabase를, 서비스 제공에는 Vercel을
            사용해요. 계정과 가정 데이터는 서비스 이용 기간 동안 보관해요. 정식
            문서에서 처리 위탁, 국외 이전, 보유 기간과 권리 행사·문의 방법을
            구체적으로 안내해요.
          </Text>
        </>
      ) : (
        <>
          <Text as="h2" variant="title-sm">
            서비스 이용
          </Text>
          <Text as="p">
            김집사는 가정의 일정과 살림을 함께 관리하는 서비스예요. 본인의
            카카오 또는 구글 계정으로 이용하고, 초대 링크는 함께 쓸 사람에게만
            공유해 주세요.
          </Text>
          <Text as="h2" variant="title-sm">
            공유와 계정
          </Text>
          <Text as="p">
            한 계정은 한 가정에만 속해요. 합류한 구성원은 모두 관리자예요.
            카카오와 구글 계정은 별개이며 합치지 않아요. 공유한 가정 정보는
            구성원이 함께 볼 수 있어요. 다른 사람의 계정을 사용하거나 허가 없이
            정보를 공개하지 말아 주세요.
          </Text>
          <Text as="h2" variant="title-sm">
            개발 중인 서비스
          </Text>
          <Text as="p">
            개발 단계에서는 기능과 이용 조건이 바뀔 수 있어요. 정식 이용 조건은
            베타 전에 안내해요.
          </Text>
        </>
      )}
    </div>
  );
}
