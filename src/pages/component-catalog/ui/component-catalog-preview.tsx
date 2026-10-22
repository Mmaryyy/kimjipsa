"use client";

import { useId, useState, type ReactNode } from "react";
import {
  Text,
  StatusBadge,
  Banner,
  Button,
  TextButton,
  SegmentedControl,
  FilterTabs,
  Switch,
  Checkbox,
  QuantityStepper,
  FormFieldRow,
  List,
  ListRow,
  ListGroupLabel,
  SectionHeader,
  CategoryDot,
  ConfirmDialog,
  Sheet,
  Toast,
  EmptyState,
  ListSkeleton,
  ErrorState,
  ThemeModeSelector,
} from "@/shared/ui";
import {
  categoryColorOptions,
  buttonOptions,
  filterOptions,
  statusLabels,
  textVariants,
  statusVariants,
  viewOptions,
} from "./component-catalog.constants";

function AppearanceSamples({ onAction }: { onAction: () => void }) {
  return (
    <>
      <SectionHeader title="글자" />
      <div className="grid gap-4 py-4">
        {textVariants.map((variant) => (
          <Text as="p" variant={variant} key={variant}>
            {variant} · 우리 집을 함께 돌봐요
          </Text>
        ))}
      </div>

      <SectionHeader title="상태와 배너" />
      <div className="grid gap-4 py-4">
        {statusVariants.map((variant) => (
          <div key={variant}>
            <StatusBadge variant={variant}>{statusLabels[variant]}</StatusBadge>
            <Banner variant={variant} title={statusLabels[variant]}>
              처리 상태를 알려드려요.
            </Banner>
          </div>
        ))}
      </div>

      <SectionHeader title="버튼" />
      <div className="flex flex-wrap items-center gap-4 py-4">
        {buttonOptions.map(([variant, label]) => (
          <Button key={variant} variant={variant} onClick={onAction}>
            {label}
          </Button>
        ))}
        <Button size="sm" onClick={onAction}>
          추가하기
        </Button>
        <Button disabled>저장하기</Button>
        <TextButton onClick={onAction}>모두 보기</TextButton>
        <TextButton size="sm" tone="danger" onClick={onAction}>
          삭제하기
        </TextButton>
        <TextButton disabled>수정하기</TextButton>
      </div>
      <Button size="block" onClick={onAction}>
        저장하기
      </Button>
    </>
  );
}

function ComponentCatalogPane({ theme }: { theme: "light" | "dark" }) {
  const fieldId = useId();
  const [view, setView] =
    useState<(typeof viewOptions)[number]["value"]>("month");
  const [filter, setFilter] =
    useState<(typeof filterOptions)[number]["value"]>("all");
  const [enabled, setEnabled] = useState(true);
  const [checked, setChecked] = useState(false);
  const [quantity, setQuantity] = useState(2);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastSequence, setToastSequence] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const showToast = () => {
    setToastSequence((sequence) => sequence + 1);
    setToastOpen(true);
  };

  return (
    <section
      data-theme={theme}
      className="min-w-0 bg-background p-4 text-foreground"
      aria-label={`${theme === "light" ? "라이트" : "다크"} 견본`}
    >
      <Text as="h2" variant="title">
        {theme === "light" ? "라이트" : "다크"}
      </Text>
      <AppearanceSamples onAction={showToast} />

      <SectionHeader title="선택과 필터" />
      <div className="grid gap-4 py-4">
        <SegmentedControl
          label="보기 방식"
          options={viewOptions}
          value={view}
          onValueChange={setView}
        />
        <FilterTabs
          label="목록 필터"
          options={filterOptions}
          value={filter}
          onValueChange={setFilter}
        />
      </div>

      <SectionHeader title="입력과 수량" />
      <FormFieldRow label="스위치" htmlFor={`${fieldId}-switch`}>
        {(controlProps) => (
          <Switch
            {...controlProps}
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        )}
      </FormFieldRow>
      <FormFieldRow label="체크" htmlFor={`${fieldId}-check`}>
        {(controlProps) => (
          <Checkbox
            {...controlProps}
            checked={checked}
            onCheckedChange={(next) => setChecked(next === true)}
          />
        )}
      </FormFieldRow>
      <div className="flex flex-wrap items-center gap-4 py-4">
        <Switch aria-label="비활성 스위치" disabled />
        <Checkbox aria-label="비활성 체크" disabled />
        <QuantityStepper
          label="견본 수량"
          value={quantity}
          min={0}
          max={10}
          onValueChange={setQuantity}
        />
      </div>
      <FormFieldRow label="이름" htmlFor={`${fieldId}-name`}>
        {(controlProps) => (
          <input {...controlProps} placeholder="이름을 입력해 주세요" />
        )}
      </FormFieldRow>
      <FormFieldRow
        label="이름"
        htmlFor={`${fieldId}-invalid`}
        invalid
        error="이름을 입력해 주세요"
      >
        {(controlProps) => <input {...controlProps} defaultValue="" />}
      </FormFieldRow>

      <SectionHeader
        title="목록과 카테고리"
        action={
          <TextButton size="sm" onClick={() => setSheetOpen(true)}>
            더 보기
          </TextButton>
        }
      />
      <ListGroupLabel>그룹 이름</ListGroupLabel>
      <List>
        <ListRow
          leading={<CategoryDot color={categoryColorOptions[0]} />}
          description="보조 정보"
          trailing={<Text variant="caption">2개</Text>}
        >
          목록 제목
        </ListRow>
        {!removed && (
          <ListRow
            leading={
              <Checkbox
                aria-label="견본 항목 선택"
                checked={checked}
                onCheckedChange={(next) => setChecked(next === true)}
              />
            }
            trailing={
              <TextButton
                size="sm"
                tone="danger"
                onClick={() => setConfirmOpen(true)}
              >
                삭제하기
              </TextButton>
            }
          >
            이름이 길어도 줄바꿈해서 읽을 수 있는 견본 항목
          </ListRow>
        )}
      </List>
      <div className="flex flex-wrap items-center gap-4 py-4">
        {categoryColorOptions.map((color) => (
          <CategoryDot
            key={color}
            color={color}
            label={`${color} 카테고리 색`}
          />
        ))}
      </div>

      <SectionHeader title="시트와 확인창" />
      <div className="flex flex-wrap items-center gap-4 py-4">
        <Sheet
          showCloseButton
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          theme={theme}
          title="견본 시트"
          description="공용 입력 행을 담은 견본이에요"
          trigger={<Button>시트 열기</Button>}
          action={
            <TextButton onClick={() => setSheetOpen(false)}>
              완료하기
            </TextButton>
          }
        >
          <FormFieldRow label="이름" htmlFor={`${fieldId}-sheet`}>
            {(controlProps) => (
              <input {...controlProps} placeholder="이름을 입력해 주세요" />
            )}
          </FormFieldRow>
          <EmptyState message="아직 항목이 없어요" />
        </Sheet>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          theme={theme}
          targetName="견본 항목"
          title="항목을 삭제할까요?"
          description="카탈로그의 견본 항목이 사라져요. 알림에서 되돌릴 수 있어요."
          trigger={<Button variant="danger">확인창 열기</Button>}
          onConfirm={() => {
            setRemoved(true);
            setConfirmOpen(false);
            showToast();
          }}
        />
        <Button onClick={showToast}>알림 띄우기</Button>
      </div>
      <Toast
        key={toastSequence}
        open={toastOpen}
        onOpenChange={setToastOpen}
        theme={theme}
        message={removed ? "견본 항목을 지웠어요" : "견본 알림이에요"}
        action={{ label: "되돌리기", onClick: () => setRemoved(false) }}
      />

      <SectionHeader title="빈 목록" />
      <EmptyState
        message="아직 항목이 없어요"
        action={
          <TextButton onClick={() => setSheetOpen(true)}>추가하기</TextButton>
        }
      />
      <SectionHeader title="불러오는 중" />
      <ListSkeleton />
      <SectionHeader title="불러오기 오류" />
      <ErrorState onRetry={() => setRetryCount((count) => count + 1)} />
      {retryCount > 0 && (
        <Text as="p" variant="caption" role="status">
          견본 다시 시도: {retryCount}회
        </Text>
      )}
    </section>
  );
}

export function ComponentCatalogPreview({ splash }: { splash: ReactNode }) {
  return (
    <>
      <SectionHeader title="화면 모드" />
      <ThemeModeSelector />
      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <ComponentCatalogPane theme="light" />
        <ComponentCatalogPane theme="dark" />
      </div>
      <SectionHeader title="앱 실행 스플래시" />
      {splash}
    </>
  );
}
