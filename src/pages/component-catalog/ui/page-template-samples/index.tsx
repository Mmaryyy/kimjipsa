import Link from "next/link";
import { Bell, Check, ChevronLeft, Plus, Trash2 } from "lucide-react";
import {
  Button,
  List,
  ListRow,
  PageLayout,
  SectionHeader,
  StatusBadge,
  Text,
  TextButton,
} from "@/shared/ui";

interface Props {
  onAction: () => void;
}
const PageTemplateSamples = ({ onAction }: Props) => {
  const actions = (
    <>
      <Button variant="glass" onClick={onAction}>
        등록
      </Button>
      <Button variant="glass" onClick={onAction}>
        설정
      </Button>
    </>
  );
  const navigation = (
    <Link
      href="/settings"
      className="inline-flex items-center gap-1 text-primary"
    >
      <ChevronLeft size={20} aria-hidden />
      설정
    </Link>
  );
  return (
    <>
      <SectionHeader title="페이지 템플릿" />
      <div className="grid gap-6 py-4">
        <PageLayout
          width="wide"
          header={{
            headingLevel: 3,
            title: "오늘",
            subtitle: "탭 최상위 · wide",
            actions: (
              <Button
                variant="glass"
                size="icon"
                aria-label="알림"
                onClick={onAction}
              >
                <Bell aria-hidden className="size-5 text-muted-foreground" />
              </Button>
            ),
          }}
        >
          <Text as="p" variant="caption">
            넓은 본문
          </Text>
        </PageLayout>
        <PageLayout
          width="narrow"
          header={{
            headingLevel: 3,
            title: "재고",
            subtitle: "목록 · narrow",
            actions,
          }}
        >
          <Text as="p" variant="caption">
            가운데 정렬 목록
          </Text>
        </PageLayout>
        <PageLayout
          width="narrow"
          header={{
            headingLevel: 3,
            title: "목록 관리",
            navigation,
            actions: (
              <Button variant="glass" onClick={onAction}>
                추가
              </Button>
            ),
          }}
        >
          <SectionHeader
            title="섹션 머리"
            action={
              <Link
                href="/calendar"
                className="kj-hit text-caption text-primary"
              >
                캘린더
              </Link>
            }
          />
        </PageLayout>
      </div>
      <SectionHeader title="위치별 버튼" />
      <List>
        <ListRow
          description="주 동작 → 설정"
          trailing={<div className="flex items-center gap-2">{actions}</div>}
        >
          페이지 머리 오른쪽
        </ListRow>
        <ListRow
          trailing={
            <Button
              variant="glass"
              size="icon"
              aria-label="머리 알림"
              onClick={onAction}
            >
              <Bell aria-hidden className="size-5 text-muted-foreground" />
            </Button>
          }
        >
          페이지 머리 아이콘
        </ListRow>
        <ListRow trailing={navigation}>머리 위 뒤로 가기</ListRow>
        <ListRow
          trailing={
            <TextButton size="sm" onClick={onAction}>
              전체 보기
            </TextButton>
          }
        >
          섹션 머리 오른쪽
        </ListRow>
        <ListRow
          trailing={
            <div className="flex items-center gap-3">
              <StatusBadge variant="warning">부족</StatusBadge>
              <TextButton size="sm" onClick={onAction}>
                담기
              </TextButton>
            </div>
          }
        >
          목록 행 오른쪽
        </ListRow>
        <ListRow
          trailing={
            <div className="flex gap-4">
              <Button size="icon-sm" aria-label="구매 완료" onClick={onAction}>
                <Check aria-hidden />
              </Button>
              <Button
                variant="danger"
                size="icon-sm"
                aria-label="삭제"
                onClick={onAction}
              >
                <Trash2 aria-hidden />
              </Button>
              <Button
                variant="gray"
                size="icon-sm"
                aria-label="담기"
                onClick={onAction}
              >
                <Plus aria-hidden />
              </Button>
            </div>
          }
        >
          행 스와이프
        </ListRow>
        <ListRow description="P10.7에서 정해요">목록 위 선택 처리</ListRow>
        <ListRow
          description={
            "왼쪽 취소 · 가운데 제목 · 오른쪽 완료 (아래 견본 시트에서 확인)"
          }
        >
          시트 머리
        </ListRow>
      </List>
      <div className="grid gap-4 py-4">
        <Button size="block" onClick={onAction}>
          폼 하단 저장
        </Button>
        <Button variant="danger" size="block" onClick={onAction}>
          삭제 확인
        </Button>
        <TextButton
          size="sm"
          className="justify-self-start text-muted-foreground"
          onClick={onAction}
        >
          기본 목록으로 되돌리기
        </TextButton>
        <Text as="p" variant="caption" className="text-muted-foreground">
          하단 고정 바 · P10.9에서 연결해요
        </Text>
      </div>
    </>
  );
};

export default PageTemplateSamples;
