"use client";
import { useState, type ReactNode } from "react";
import {
  FormProvider,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { useProjectWrite, type ProjectCommand } from "@/entities/project";
import { cn } from "@/shared/lib";
import { FormSheet, TextButton, useConfirm } from "@/shared/ui";
import { projectFormFieldStyles } from "./project-form.styles";

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>;
  title: string;
  description?: string;
  odId: string;
  submitLabel?: string;
  children: ReactNode;
  onClose: () => void;
  afterSave?: (id: string, item: T) => Promise<void> | void;
  savedPath?: (id: string) => string;
  command: (item: T) => ProjectCommand;
  deletion?: {
    command: ProjectCommand;
    name: string;
    description: string;
    deletedPath?: string;
    onDeleted?: () => void;
  };
};

function ProjectFormSheet<T extends FieldValues>({
  form,
  title,
  description = "",
  odId,
  submitLabel,
  children,
  onClose,
  savedPath,
  afterSave,
  command,
  deletion,
}: Props<T>) {
  const write = useProjectWrite();
  const confirm = useConfirm();
  const [error, setError] = useState("");
  const { isDirty, isSubmitting } = form.formState;
  const pending = isSubmitting || write.isPending;

  async function remove() {
    if (!deletion) return;
    const deleted = await confirm({
      title: `${deletion.name} 삭제`,
      description: deletion.description,
      confirmLabel: "삭제",
      destructive: true,
      onConfirm: () => write.mutateAsync(deletion.command),
    });
    if (deleted) {
      if (deletion.deletedPath) window.location.replace(deletion.deletedPath);
      else (deletion.onDeleted ?? onClose)();
    }
  }

  return (
    <FormProvider {...form}>
      <FormSheet
        open
        title={title}
        description={description}
        odId={odId}
        className="max-md:rounded-t-[var(--r-dialog)]"
        dirty={isDirty}
        pending={pending}
        submitLabel={submitLabel}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        onSaved={onClose}
      >
        {(formId, finish) => (
          <form
            id={formId}
            className={cn("space-y-4", projectFormFieldStyles())}
            onSubmit={form.handleSubmit(async (item) => {
              setError("");
              try {
                const { id } = await write.mutateAsync(command(item));
                await afterSave?.(id, item);
                // Replace the temporary sheet history entry when saving opens a page.
                if (savedPath) window.location.replace(savedPath(id));
                else finish();
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "저장하지 못했어요.",
                );
              }
            })}
          >
            <fieldset disabled={pending} className="grid min-w-0 gap-4">
              {children}
            </fieldset>
            {deletion && (
              <TextButton
                type="button"
                className="text-destructive"
                disabled={pending}
                onClick={() => void remove()}
              >
                {deletion.name} 삭제
              </TextButton>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </form>
        )}
      </FormSheet>
    </FormProvider>
  );
}

export default ProjectFormSheet;
