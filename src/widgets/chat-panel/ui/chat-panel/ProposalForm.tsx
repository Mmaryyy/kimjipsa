"use client";
import { useId, useState } from "react";
import type { AgentAction } from "@/entities/chat-message";
import {
  eventVisibility,
  recurrenceOptions,
  reminderOptions,
  useEventCategories,
} from "@/entities/event";
import {
  inventoryStatusOptions,
  useInventoryMeta,
} from "@/entities/inventory-item";
import {
  taskAssignees,
  taskStatusLabels,
  useProject,
} from "@/entities/project";
import { cn } from "@/shared/lib";
import { Button, Input, QuantityStepper, Select, Text } from "@/shared/ui";
import { DateTimeInput } from "@/shared/ui/date-time-input";
import { chatProposalChoiceStyles } from "./chat-panel.variants";

type Fields = AgentAction["payload"];
type Value = Fields[string];
interface Option {
  value: Value;
  label: string;
}
const objectFields = (value: Value): Fields | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;
const textValue = (value: Value) => (typeof value === "string" ? value : "");

interface ChoicesProps {
  label: string;
  value: Value;
  options: readonly Option[];
  category?: boolean;
  onChange: (value: Value) => void;
}
const ProposalChoices = ({
  label,
  value,
  options,
  category,
  onChange,
}: ChoicesProps) => (
  <fieldset className="space-y-1">
    <legend className="text-caption text-muted-foreground">{label}</legend>
    <div className={cn("flex flex-wrap gap-1", category && "gap-y-2")}>
      {options.length === 0 && (
        <Text as="p" variant="caption">
          고를 수 있는 항목이 없어요.
        </Text>
      )}
      {options.map((option) => (
        <Button
          key={String(option.value)}
          type="button"
          variant={null}
          className={chatProposalChoiceStyles()}
          size={category ? "touch" : "sm"}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  </fieldset>
);
interface FieldsProps {
  fields: Fields;
  event?: boolean;
  onChange: (fields: Fields) => void;
}
const ProposalFields = ({ fields, event = false, onChange }: FieldsProps) => {
  const inputId = useId();
  const meta = useInventoryMeta();
  const categories = useEventCategories();
  const update = (key: string, value: Value) =>
    onChange({ ...fields, [key]: value });
  const options: Record<string, readonly Option[]> = {
    visibility: Object.entries(eventVisibility).map(([value, label]) => ({
      value,
      label,
    })),
    categoryId: (categories.data ?? []).map(({ id, name }) => ({
      value: id,
      label: name,
    })),
    category_id: (meta.data?.categories ?? []).map(({ id, name }) => ({
      value: id,
      label: name,
    })),
    location_id: (meta.data?.locations ?? [])
      .filter(({ enabled }) => enabled)
      .map(({ id, name }) => ({ value: id, label: name })),
    unit_id: (meta.data?.units ?? []).map(({ id, name }) => ({
      value: id,
      label: name,
    })),
    mode: [
      { value: "quantity", label: "수량" },
      { value: "status", label: "상태" },
    ],
    status: inventoryStatusOptions,
    isAllDay: [
      { value: true, label: "종일" },
      { value: false, label: "시각 지정" },
    ],
    remindBefore: reminderOptions,
    recurrence: recurrenceOptions.map(({ value, label }) => ({
      value: value === "none" ? null : value,
      label,
    })),
    ddayStyle: [
      { value: "normal", label: "기본" },
      { value: "celebrate", label: "축하" },
    ],
    kind: [
      { value: "event", label: "일정" },
      { value: "dday", label: "D-day" },
    ],
    scope: [
      { value: "single", label: "이번 일정만" },
      { value: "following", label: "이후 모든 일정" },
    ],
    duplicate: [
      { value: "merge", label: "합치기" },
      { value: "separate", label: "따로 담기" },
    ],
    checked: [
      { value: true, label: "담음" },
      { value: false, label: "담지 않음" },
    ],
  };
  const labels: Record<string, string> = {
    title: "제목",
    name: "품목명",
    place: "장소",
    memo: "메모",
    link_url: "링크",
    celebrateMessage: "축하 문구",
    visibility: "공개 범위",
    categoryId: "카테고리",
    category_id: "카테고리",
    location_id: "보관 위치",
    unit_id: "단위",
    mode: "재고 모드",
    status: "재고 상태",
    isAllDay: "종일",
    remindBefore: "알림",
    recurrence: "반복",
    ddayStyle: "D-day 표시",
    kind: "일정 종류",
    scope: "수정 범위",
    duplicate: "같은 품목",
    checked: "담음 상태",
    quantity: "수량",
    delta: "수량 변화",
    min_quantity: "부족 기준",
  };
  const range = {
    startDate: textValue(fields.startDate ?? fields.expires_on),
    endDate: textValue(fields.endDate ?? fields.expires_on),
    startTime: textValue(fields.startTime),
    endTime: textValue(fields.endTime),
  };
  const dateControl = (end = false) => {
    const dateKey = event ? (end ? "endDate" : "startDate") : "expires_on";
    const label = event ? (end ? "종료" : "시작") : "유통기한";
    return (
      <div className="space-y-1" key={dateKey}>
        <Text as="p" variant="caption">
          {label}
        </Text>
        <DateTimeInput
          label={label}
          range={range}
          initialTab={end ? "end" : "start"}
          dateOnly={!event || fields.isAllDay === true}
          singleDate={!event}
          controlProps={{ id: `${inputId}-${dateKey}` }}
          onConfirm={(next) =>
            onChange(
              event
                ? {
                    ...fields,
                    startDate: next.startDate,
                    endDate: next.endDate,
                    startTime: fields.isAllDay ? null : next.startTime || null,
                    endTime: fields.isAllDay ? null : next.endTime || null,
                  }
                : { ...fields, expires_on: next.startDate },
            )
          }
        />
        {!event && (
          <Button
            type="button"
            variant="gray"
            size="sm"
            onClick={() => update("expires_on", null)}
          >
            날짜 비우기
          </Button>
        )}
      </div>
    );
  };
  return (
    <div className="min-w-0 space-y-3">
      {(meta.isPending || categories.isPending) && (
        <Text as="p" variant="caption" role="status">
          선택 목록을 불러오고 있어요.
        </Text>
      )}
      {(meta.isError || categories.isError) && (
        <Text as="p" role="alert" variant="caption">
          선택 목록을 불러오지 못했어요.{" "}
          <Button
            type="button"
            size="sm"
            variant="gray"
            onClick={() => {
              void meta.refetch();
              void categories.refetch();
            }}
          >
            다시 시도
          </Button>
        </Text>
      )}
      {Object.entries(fields).map(([key, value]) => {
        if (!labels[key]) return null;
        if (
          fields.kind === "event" &&
          ["ddayStyle", "celebrateMessage"].includes(key)
        )
          return null;
        if (fields.kind === "dday" && key === "recurrence") return null;
        if (
          fields.mode === "status" &&
          ["quantity", "unit_id", "min_quantity"].includes(key)
        )
          return null;
        if (fields.mode === "quantity" && key === "status") return null;
        if (options[key])
          return (
            <ProposalChoices
              key={key}
              label={labels[key]}
              value={value}
              options={options[key]}
              category={key === "category_id"}
              onChange={(next) => {
                let patch: Fields = { [key]: next };
                if (key === "isAllDay" && next === true)
                  patch = { ...patch, startTime: null, endTime: null };
                onChange({ ...fields, ...patch });
              }}
            />
          );
        if (["quantity", "delta", "min_quantity"].includes(key))
          return (
            <div key={key}>
              <Text as="p" variant="caption">
                {labels[key]}
              </Text>
              <QuantityStepper
                label={labels[key]}
                value={typeof value === "number" ? value : 0}
                min={key === "delta" ? -Infinity : 0}
                allowDirectInput
                onValueChange={(next) => update(key, next)}
              />
              {key === "min_quantity" && (
                <Button
                  type="button"
                  size="sm"
                  variant="gray"
                  onClick={() => update(key, null)}
                >
                  기준 없음
                </Button>
              )}
            </div>
          );
        return (
          <label key={key} className="block space-y-1 text-caption">
            {labels[key]}
            <Input
              value={textValue(value)}
              onChange={(e) => update(key, e.target.value)}
            />
          </label>
        );
      })}
      {event && (
        <>
          {dateControl()}
          {dateControl(true)}
        </>
      )}
      {"expires_on" in fields && dateControl()}
    </div>
  );
};

const ProjectProposalFields = ({
  payload,
  fields,
  onChange,
}: FieldsProps & { payload: Fields }) => {
  const inputId = useId();
  const project = useProject(textValue(payload.projectId));
  const expense = payload.action === "save_expense";
  const update = (key: string, value: Value) =>
    onChange({ ...fields, [key]: value });
  const dates = expense
    ? [
        ["planned_on", "예상 결제일"],
        ["paid_on", "실제 결제일"],
      ]
    : [
        ["starts_on", "시작일"],
        ["due_on", "마감일"],
      ];
  const members = project.data?.members ?? [];
  const assignee =
    fields.assignee_kind === "member"
      ? textValue(fields.assignee_id)
      : textValue(fields.assignee_kind);

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-caption">
        제목
        <Input
          required
          maxLength={100}
          value={textValue(fields.title)}
          onChange={(event) => update("title", event.target.value)}
        />
      </label>
      {project.isError && (
        <Text variant="caption" role="alert">
          프로젝트 선택 목록을 불러오지 못했어요.{" "}
          <Button
            type="button"
            size="sm"
            variant="gray"
            onClick={() => void project.refetch()}
          >
            다시 시도
          </Button>
        </Text>
      )}
      {project.data && (
        <>
          <label className="block space-y-1 text-caption">
            영역
            <Select
              value={textValue(fields.area_id)}
              onChange={(event) =>
                update("area_id", event.target.value || null)
              }
            >
              <option value="">영역 없음</option>
              {project.data.areas.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </label>
          {expense ? (
            <label className="block space-y-1 text-caption">
              결제자
              <Select
                value={textValue(fields.payer_id)}
                onChange={(event) =>
                  update("payer_id", event.target.value || null)
                }
              >
                <option value="">선택 안 함</option>
                {members.map(({ user_id, display_name }) => (
                  <option key={user_id} value={user_id}>
                    {display_name}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <label className="block space-y-1 text-caption">
              담당
              <Select
                value={assignee}
                onChange={(event) => {
                  const value = event.target.value;
                  const member = members.some(
                    ({ user_id }) => user_id === value,
                  );
                  onChange({
                    ...fields,
                    assignee_kind: member ? "member" : value,
                    assignee_id: member ? value : null,
                  });
                }}
              >
                {taskAssignees(members).map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </>
      )}
      {dates.map(([key, label]) => {
        const date = textValue(fields[key]);
        return (
          <div className="space-y-1" key={key}>
            <Text as="p" variant="caption">
              {label}
            </Text>
            <DateTimeInput
              label={label}
              controlProps={{ id: `${inputId}-${key}` }}
              range={{
                startDate: date,
                endDate: date,
                startTime: "",
                endTime: "",
              }}
              dateOnly
              singleDate
              onConfirm={(next) => update(key, next.startDate)}
            />
            {date && (
              <Button
                type="button"
                variant="gray"
                size="sm"
                onClick={() => update(key, null)}
              >
                날짜 비우기
              </Button>
            )}
          </div>
        );
      })}
      {expense ? (
        [
          ["estimated_amount", "예상 금액"],
          ["actual_amount", "실제 금액"],
        ].map(([key, label]) => {
          const value = fields[key];
          return (
            <label className="block space-y-1 text-caption" key={key}>
              {label}
              <Input
                type="number"
                min={0}
                max={Number.MAX_SAFE_INTEGER}
                step={1}
                value={typeof value === "number" ? value : ""}
                onChange={(event) =>
                  update(
                    key,
                    event.target.value === ""
                      ? null
                      : event.target.valueAsNumber,
                  )
                }
              />
            </label>
          );
        })
      ) : (
        <>
          <label className="block space-y-1 text-caption">
            상태
            <Select
              value={textValue(fields.status)}
              onChange={(event) => update("status", event.target.value)}
            >
              {(["todo", "in_progress", "on_hold"] as const).map((value) => (
                <option key={value} value={value}>
                  {taskStatusLabels[value]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1 text-caption">
            선행 조건
            <Input
              maxLength={1000}
              value={textValue(fields.depends_note)}
              onChange={(event) => update("depends_note", event.target.value)}
            />
          </label>
        </>
      )}
      <label className="block space-y-1 text-caption">
        메모
        <Input
          maxLength={1000}
          value={textValue(fields.memo)}
          onChange={(event) => update("memo", event.target.value)}
        />
      </label>
    </div>
  );
};

interface Props {
  actions: AgentAction[];
  pending: boolean;
  error?: string;
  onSave: (actions: AgentAction[]) => void;
  onClose: () => void;
}
const ChatProposalForm = ({
  actions,
  pending,
  error,
  onSave,
  onClose,
}: Props) => {
  const [draft, setDraft] = useState(actions);
  const update = (index: number, payload: Fields) =>
    setDraft((current) =>
      current.map((action, i) =>
        i === index ? { ...action, payload } : action,
      ),
    );
  return (
    <form
      aria-label="변경 내용 수정"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {draft.map((action, index) => {
          const nestedKey = action.domain === "event" ? "event" : "item";
          const nested = objectFields(action.payload[nestedKey]);
          if (action.domain === "project") {
            return (
              <fieldset key={index} className="min-w-0 space-y-3">
                <legend className="mb-2 text-label">{action.label}</legend>
                {nested ? (
                  <ProjectProposalFields
                    payload={action.payload}
                    fields={nested}
                    onChange={(item) =>
                      update(index, { ...action.payload, item })
                    }
                  />
                ) : (
                  <Text variant="caption">
                    완료할 항목을 바꾸려면 취소하고 다시 요청해 주세요.
                  </Text>
                )}
              </fieldset>
            );
          }
          const entries = action.payload.entries;
          return (
            <fieldset key={index} className="min-w-0 space-y-3">
              <legend className="mb-2 text-label">{action.label}</legend>
              {nested && (
                <ProposalFields
                  fields={nested}
                  event={action.domain === "event"}
                  onChange={(next) =>
                    update(index, { ...action.payload, [nestedKey]: next })
                  }
                />
              )}
              <ProposalFields
                fields={action.payload}
                onChange={(next) => update(index, next)}
              />
              {Array.isArray(entries) &&
                entries.map((entry, i) => {
                  const fields = objectFields(entry);
                  if (!fields) return null;
                  return (
                    <ProposalFields
                      key={i}
                      fields={fields}
                      onChange={(next) =>
                        update(index, {
                          ...action.payload,
                          entries: entries.map((value, j) =>
                            i === j ? next : value,
                          ),
                        })
                      }
                    />
                  );
                })}
            </fieldset>
          );
        })}
        {error && (
          <Text
            as="p"
            variant="caption"
            role="alert"
            className="text-error-text"
          >
            {error}
          </Text>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            저장
          </Button>
          <Button type="button" size="sm" variant="gray" onClick={onClose}>
            수정 취소
          </Button>
        </div>
      </fieldset>
    </form>
  );
};
export default ChatProposalForm;
