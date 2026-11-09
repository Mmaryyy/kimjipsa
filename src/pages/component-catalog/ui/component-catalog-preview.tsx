"use client";
import {
  readableTextColor,
  resolveCategoryColor,
  type CategoryColor,
} from "@/shared/lib";

import {
  InventoryStatusCapsule,
  inventoryStatusOptions,
  type InventoryItem,
} from "@/entities/inventory-item";
import { Bell, Check, Plus, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import {
  Text,
  StatusBadge,
  Badge,
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

import SortableList from "@/shared/ui/sortable-list";

import PageTemplateSamples from "./page-template-samples";

const SortableListSample = () => {
  const [items, setItems] = useState([
    { id: "food", name: "식품" },
    { id: "house", name: "생활용품" },
  ]);
  return (
    <>
      <Text as="p" variant="caption">
        손잡이를 끌거나 스페이스로 집고 방향키로 이동한 뒤 스페이스로 놓으세요.
        ESC로 취소해요.
      </Text>
      <SortableList
        items={items}
        onEdit={() => {}}
        renderItem={(item) => <span>{item.name}</span>}
        onMove={(active, over) => {
          const next = [...items];
          const from = next.findIndex((item) => item.id === active);
          const to = next.findIndex((item) => item.id === over);
          const [item] = next.splice(from, 1);
          if (item) next.splice(to, 0, item);
          setItems(next);
        }}
      />
    </>
  );
};

const InventoryCapsuleSample = ({
  initialValue,
  initialOpen = false,
}: {
  initialValue: InventoryItem["status"];
  initialOpen?: boolean;
}) => {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(initialOpen);
  return (
    <InventoryStatusCapsule
      label={`견본 ${initialValue}`}
      value={value}
      open={open}
      onOpenChange={setOpen}
      onValueChange={setValue}
    />
  );
};

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
      <Badge>중립 배지</Badge>
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
        <Button variant="glass" onClick={onAction}>
          등록
        </Button>
        <Button
          variant="glass"
          size="icon"
          aria-label="알림"
          onClick={onAction}
        >
          <Bell aria-hidden className="size-5 text-muted-foreground" />
        </Button>
        <Button variant="glass" disabled>
          비활성 등록
        </Button>
        <Button variant="glass" size="icon" disabled aria-label="비활성 알림">
          <Bell aria-hidden className="size-5 text-muted-foreground" />
        </Button>
        <Button disabled>저장하기</Button>
        <TextButton size="sm" onClick={onAction}>
          전체 보기
        </TextButton>
        <TextButton onClick={onAction}>모두 보기</TextButton>
        <TextButton size="sm" tone="danger" onClick={onAction}>
          삭제하기
        </TextButton>
        <TextButton disabled>수정하기</TextButton>
      </div>
      <p className="text-caption text-muted-foreground">
        icon-sm · 원형 32px · 아이콘 16px · 누름 영역 44px
      </p>
      <div className="flex items-center gap-4 py-4">
        <Button
          size="icon-sm"
          variant="gray"
          aria-label="담기"
          onClick={onAction}
        >
          <Plus aria-hidden />
        </Button>
        <Button
          size="icon-sm"
          variant="primary"
          aria-label="구매 완료"
          onClick={onAction}
        >
          <Check aria-hidden />
        </Button>
        <Button
          size="icon-sm"
          variant="danger"
          aria-label="삭제"
          onClick={onAction}
        >
          <Trash2 aria-hidden />
        </Button>
        <Button size="icon-sm" disabled aria-label="비활성 구매 완료">
          <Check aria-hidden />
        </Button>
      </div>
      <Button size="block" onClick={onAction}>
        저장하기
      </Button>
    </>
  );
}

const CategoryLabelSamples = () => (
  <div className="flex flex-wrap gap-2 py-4" aria-label="카테고리 라벨 견본">
    {[...categoryColorOptions, null].map((preset) => (
      <span
        key={preset ?? "custom"}
        className="rounded px-2 py-1"
        ref={(node) => {
          if (!node) return;
          const color =
            preset ??
            (getComputedStyle(document.documentElement)
              .getPropertyValue("--sys-red")
              .trim() as CategoryColor);
          node.style.backgroundColor = resolveCategoryColor(color);
          node.style.color = readableTextColor(color);
        }}
      >
        {preset ?? "직접 선택"} 일정
      </span>
    ))}
  </div>
);

function ComponentCatalogPane({ theme }: { theme: "light" | "dark" }) {
  const fieldId = useId();
  const [view, setView] =
    useState<(typeof viewOptions)[number]["value"]>("month");
  const [filter, setFilter] =
    useState<(typeof filterOptions)[number]["value"]>("all");
  const [enabled, setEnabled] = useState(true);
  const [checked, setChecked] = useState(false);
  const [quantity, setQuantity] = useState(2);
  const [stepperOpen, setStepperOpen] = useState(false);
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
      <PageTemplateSamples onAction={showToast} />

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

      <SectionHeader title="재고 상태 캡슐" />
      <div className="flex flex-wrap items-center gap-4 py-4">
        {inventoryStatusOptions.map((option) => (
          <InventoryCapsuleSample
            key={option.value}
            initialValue={option.value}
          />
        ))}
        <InventoryCapsuleSample initialValue="enough" initialOpen />
      </div>
      <SectionHeader title="수량 스테퍼" />
      <div className="flex flex-wrap items-center gap-4 py-4">
        <Text variant="caption">기본</Text>
        <QuantityStepper
          label="견본 수량"
          value={quantity}
          min={0}
          max={10}
          onValueChange={setQuantity}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 pb-4">
        <Text variant="caption">접힘 · 눌러서 펼치기</Text>
        <QuantityStepper
          label="접힘 견본"
          value={quantity}
          unit="팩"
          allowDirectInput
          onValueChange={setQuantity}
          min={0}
          max={10}
          collapsible={{ open: stepperOpen, onOpenChange: setStepperOpen }}
        />
      </div>

      <div className="pb-4">
        <QuantityStepper
          label="펼침 견본"
          value={quantity}
          unit="팩"
          allowDirectInput
          onValueChange={setQuantity}
          collapsible={{ open: true, onOpenChange: () => {} }}
        />
      </div>

      <SectionHeader
        title="목록과 카테고리"
        action={
          <TextButton size="sm" onClick={() => setSheetOpen(true)}>
            더 보기
          </TextButton>
        }
      />
      <SortableListSample />
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

      <CategoryLabelSamples />
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
          leadingAction={(onOpenChange) => (
            <TextButton onClick={() => onOpenChange(false)}>취소</TextButton>
          )}
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
