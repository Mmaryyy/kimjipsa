"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import {
  columnTypes,
  projectListInput,
  type ProjectColumn,
  type ProjectListDefinition,
  type ProjectListInput,
} from "@/entities/project";
import { Button, FormField, SectionHeader, TextButton } from "@/shared/ui";
import ProjectFormSheet from "../project-form-sheet";

const Field = FormField<ProjectListInput>;
const columnLabels = {
  text: "글",
  number: "숫자",
  money: "금액",
  select: "선택",
};
const kindOptions = [
  { value: "candidates", label: "후보 목록" },
  { value: "people", label: "명단" },
] as const;
const variant = { variant: "default" } as const;

function ListEditor({
  projectId,
  kind,
  list,
  lists,
  onClose,
}: {
  projectId: string;
  kind: ProjectListInput["kind"];
  list?: ProjectListDefinition;
  lists: ProjectListDefinition[];
  onClose: () => void;
}) {
  const basePath = `/projects/${projectId}/lists`;
  const form = useForm<ProjectListInput>({
    resolver: zodResolver(projectListInput),
    defaultValues: list ?? {
      name: "",
      kind,
      columns: [],
      tags: [],
      quantity_list_id: null,
      quantity_tag_key: null,
    },
  });
  const { control, setValue } = form;
  const columns = useFieldArray({ control, name: "columns" });
  const tags = useFieldArray({ control, name: "tags" });
  const watchedColumns = useWatch({ control, name: "columns" });
  const listKind = useWatch({ control, name: "kind" });
  const sourceId = useWatch({ control, name: "quantity_list_id" });
  const rosters = lists.filter(
    (row) => row.kind === "people" && row.tags.length,
  );
  const source = rosters.find((row) => row.id === sourceId);

  function changeKind(next: ProjectListInput["kind"]) {
    setValue("quantity_list_id", null, { shouldDirty: true });
    setValue("quantity_tag_key", null, { shouldDirty: true });
    if (next === "candidates") tags.replace([]);
    return next;
  }

  return (
    <ProjectFormSheet
      form={form}
      title={list ? "목록·사용자 정의 칸 설정" : "새 목록"}
      odId="prj-list-columns"
      onClose={onClose}
      savedPath={list ? undefined : (id) => `${basePath}/${id}`}
      command={(item) => ({
        action: "save_list",
        projectId,
        id: list?.id,
        item,
      })}
      deletion={
        list && {
          command: { action: "delete_list", projectId, id: list.id },
          name: list.name,
          description:
            "목록의 항목과 사진이 함께 삭제되고 연결된 수량 기준을 해제해요.",
          deletedPath: `${basePath}?kind=${list.kind}`,
        }
      }
    >
      <Field
        name="name"
        label="목록 이름"
        inputProps={{ maxLength: 100, className: "text-left!" }}
      />
      {!list && (
        <Field
          name="kind"
          label="목록 종류"
          type="select"
          options={kindOptions}
          parse={(value) => changeKind(value)}
          inputProps={variant}
        />
      )}
      {listKind === "candidates" && (
        <>
          <Field
            name="quantity_list_id"
            label="수량 명단"
            type="select"
            noneLabel="수량 기준 없음"
            options={rosters.map((roster) => ({
              value: roster.id,
              label: roster.name,
            }))}
            inputProps={variant}
            parse={(value) => {
              setValue("quantity_tag_key", null, { shouldDirty: true });
              return value;
            }}
          />
          {source && (
            <Field
              name="quantity_tag_key"
              label="명단 태그"
              type="select"
              noneLabel="태그 선택"
              options={source.tags.map((tag) => ({
                value: tag.key,
                label: tag.label,
              }))}
              inputProps={variant}
            />
          )}
        </>
      )}
      <section aria-label="사용자 정의 칸" className="grid gap-3">
        <SectionHeader title="사용자 정의 칸" />
        {columns.fields.map(({ id }, index) => (
          <fieldset
            key={id}
            className="grid min-w-0 gap-2 border-b border-border pb-3"
          >
            <legend className="sr-only">{index + 1}번째 사용자 정의 칸</legend>
            <Field
              name={`columns.${index}.label`}
              label="칸 이름"
              inputProps={{ maxLength: 100, className: "text-left!" }}
            />
            <Field
              name={`columns.${index}.type`}
              label="칸 유형"
              type="select"
              options={columnTypes.map((value) => ({
                value,
                label: columnLabels[value],
              }))}
              inputProps={variant}
              parse={(type: ProjectColumn["type"]) => {
                if (type !== "select")
                  setValue(`columns.${index}.options`, [], {
                    shouldDirty: true,
                  });
                return type;
              }}
            />
            {watchedColumns[index]?.type === "select" && (
              <Field
                name={`columns.${index}.options`}
                label="선택 옵션"
                hint="줄마다 옵션 하나를 입력해 주세요."
                type="textarea"
                format={(options: string[]) => options.join("\n")}
                parse={(value) => value.split("\n")}
              />
            )}
            <TextButton
              type="button"
              className="justify-self-start text-destructive"
              onClick={() => columns.remove(index)}
            >
              칸 삭제
            </TextButton>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="gray"
          onClick={() =>
            columns.append({
              key: crypto.randomUUID(),
              label: "",
              type: "text",
              options: [],
            })
          }
        >
          칸 추가
        </Button>
      </section>
      {listKind === "people" && (
        <section aria-label="명단 태그" className="grid gap-3">
          <SectionHeader title="명단 태그" />
          {tags.fields.map(({ id }, index) => (
            <div key={id} className="flex items-end gap-2">
              <Field
                name={`tags.${index}.label`}
                label="태그 이름"
                className="min-w-0 flex-1"
                inputProps={{ maxLength: 100, className: "text-left!" }}
              />
              <TextButton
                type="button"
                className="text-destructive"
                onClick={() => tags.remove(index)}
              >
                태그 삭제
              </TextButton>
            </div>
          ))}
          <Button
            type="button"
            variant="gray"
            onClick={() => tags.append({ key: crypto.randomUUID(), label: "" })}
          >
            태그 추가
          </Button>
        </section>
      )}
    </ProjectFormSheet>
  );
}

export default ListEditor;
