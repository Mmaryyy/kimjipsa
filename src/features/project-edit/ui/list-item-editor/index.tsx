"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  candidateStatuses,
  candidateStatusLabels,
  projectListItemInput,
  projectListLinks,
  uploadProjectPhoto,
  validProjectValues,
  type ProjectColumn,
  type ProjectListDefinition,
  type ProjectListItem,
  type ProjectListItemInput,
} from "@/entities/project";
import { Button, Checkbox, FormField, Input } from "@/shared/ui";
import ProjectFormSheet from "../project-form-sheet";

const splitLinks = (links: string) =>
  links
    .split("\n")
    .map((link) => link.trim())
    .filter(Boolean);
const valueSchema = z.union([z.string().max(1000), z.number(), z.null()]);
const formSchema = z.object({
  ...projectListItemInput.shape,
  links: z
    .string()
    .refine(
      (links) => projectListLinks.safeParse(splitLinks(links)).success,
      "http 또는 https 링크를 한 줄에 하나씩 입력해 주세요.",
    ),
  values: z.record(z.string(), valueSchema),
  files: z.array(z.file()),
});
type ItemForm = z.infer<typeof formSchema>;
const Field = FormField<ItemForm>;
const variant = { variant: "default" } as const;

function itemValues(
  values: ItemForm["values"],
): ProjectListItemInput["values"] {
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, string | number] =>
        entry[1] !== null && entry[1] !== "",
    ),
  );
}

function ColumnField({ column }: { column: ProjectColumn }) {
  const name = `values.${column.key}` as const;
  if (column.type === "select") {
    return (
      <Field
        name={name}
        label={column.label}
        type="select"
        noneLabel="선택 안 함"
        options={column.options.map((value) => ({ value, label: value }))}
        inputProps={variant}
      />
    );
  }
  if (column.type === "number" || column.type === "money") {
    return (
      <Field
        name={name}
        label={column.label}
        type="number"
        parse={(value) => (Number.isNaN(value) ? null : value)}
        format={(value) => (typeof value === "number" ? value : NaN)}
        inputProps={{
          step: "any",
          className: "text-left!",
          min: column.type === "money" ? 0 : undefined,
        }}
      />
    );
  }
  return (
    <Field
      name={name}
      label={column.label}
      inputProps={{ maxLength: 1000, className: "text-left!" }}
    />
  );
}

function ListItemEditor({
  list,
  item,
  onClose,
  onSaved,
}: {
  list: ProjectListDefinition;
  item?: ProjectListItem;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const projectId = list.project_id;
  const listId = list.id;
  const candidate = list.kind === "candidates";
  const noun = candidate ? "후보" : "사람";
  const savedId = useRef(item?.id);
  const tagId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const query = useQueryClient();
  const form = useForm<ItemForm>({
    resolver: zodResolver(
      formSchema.superRefine(({ values }, context) => {
        for (const [key, value] of Object.entries(itemValues(values))) {
          if (!validProjectValues(list.columns, { [key]: value })) {
            context.addIssue({
              code: "custom",
              path: ["values", key],
              message: "칸에 맞는 값을 입력해 주세요.",
            });
          }
        }
      }),
    ),
    defaultValues: {
      title: item?.title ?? "",
      status: item?.status ?? (candidate ? "candidate" : null),
      price: item?.price ?? null,
      links: item?.links.join("\n") ?? "",
      values: Object.fromEntries(
        list.columns.map(({ key }) => [key, item?.values[key] ?? null]),
      ),
      tags: item?.tags ?? [],
      done_tags: item?.done_tags ?? [],
      memo: item?.memo ?? "",
      files: [],
    },
  });

  return (
    <ProjectFormSheet
      form={form}
      title={`${noun} ${item ? "수정" : "추가"}`}
      odId={candidate ? "prj-candidate-editor" : "prj-people-editor"}
      onClose={onClose}
      command={({
        links,
        values,
        title,
        status,
        price,
        tags,
        done_tags,
        memo,
      }) => ({
        action: "save_list_item",
        projectId,
        listId,
        id: savedId.current,
        item: {
          links: splitLinks(links),
          values: itemValues(values),
          title,
          status,
          price,
          tags,
          done_tags: done_tags.filter((key) => tags.includes(key)),
          memo,
        },
      })}
      afterSave={async (id, { files }) => {
        savedId.current = id;
        for (const [index, file] of files.entries()) {
          try {
            await uploadProjectPhoto(projectId, listId, id, file);
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "사진을 올리지 못했어요.";
            throw new Error(`항목을 저장했어요. ${file.name} · ${message}`);
          }
          form.setValue("files", files.slice(index + 1), { shouldDirty: true });
          void query.invalidateQueries({ queryKey: ["projects", projectId] });
        }
        onSaved(id);
      }}
      deletion={
        item && {
          command: {
            action: "delete_list_item",
            projectId,
            listId,
            id: item.id,
          },
          name: item.title,
          description: candidate
            ? "후보와 사진을 삭제해요."
            : "명단에서 이 사람을 삭제해요.",
        }
      }
    >
      <Field
        name="title"
        label="이름"
        inputProps={{ maxLength: 100, className: "text-left!" }}
      />
      {candidate && (
        <>
          <Field
            name="price"
            label="가격"
            type="number"
            parse={(value) => (Number.isNaN(value) ? null : value)}
            format={(value) => value ?? NaN}
            inputProps={{ min: 0, step: "any", className: "text-left!" }}
          />
          <Field
            name="status"
            label="상태"
            type="select"
            inputProps={variant}
            options={candidateStatuses.map((value) => ({
              value,
              label: candidateStatusLabels[value],
            }))}
          />
          <Field
            name="links"
            label="링크 여러 개"
            type="textarea"
            hint="줄마다 링크 하나를 입력해 주세요."
          />
          <Field
            name="files"
            label="사진"
            render={({
              value,
              onChange,
              id,
              onBlur,
              "aria-describedby": describedBy,
            }) => (
              <div className="grid w-full min-w-0 gap-1">
                <Input
                  ref={fileInput}
                  type="file"
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onBlur={onBlur}
                  onChange={(event) => {
                    onChange(Array.from(event.currentTarget.files ?? []));
                    event.currentTarget.value = "";
                  }}
                />
                <Button
                  id={id}
                  type="button"
                  variant="gray"
                  className="justify-self-start"
                  aria-describedby={describedBy}
                  onClick={() => fileInput.current?.click()}
                >
                  사진 선택
                </Button>
                {value.length > 0 && (
                  <p className="text-sm break-all text-muted-foreground">
                    {value.map((file) => file.name).join(", ")}
                  </p>
                )}
              </div>
            )}
          />
        </>
      )}
      {list.tags.length > 0 && (
        <Field
          name="tags"
          label="태그"
          showLabel={false}
          render={({ value, onChange }) => (
            <fieldset className="flex flex-wrap gap-3">
              <legend className="mb-2 text-sm text-muted-foreground">
                태그
              </legend>
              {list.tags.map(({ key, label }) => {
                const id = `${tagId}-${key}`;
                return (
                  <label
                    key={key}
                    htmlFor={id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      id={id}
                      checked={value.includes(key)}
                      onCheckedChange={(checked) =>
                        onChange(
                          checked
                            ? [...value, key]
                            : value.filter((tag) => tag !== key),
                        )
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </fieldset>
          )}
        />
      )}
      {list.columns.map((column) => (
        <ColumnField key={column.key} column={column} />
      ))}
      <Field
        name="memo"
        label="메모"
        type="textarea"
        inputProps={{ maxLength: 1000 }}
      />
    </ProjectFormSheet>
  );
}

export default ListItemEditor;
