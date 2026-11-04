import { z } from "zod";

export class CloudError extends Error {
  constructor(
    code: string,
    readonly detail?: string,
    readonly field?: string,
  ) {
    super(code);
  }
}

export async function readCloudResponse(response: Response) {
  const envelope = z
    .object({
      ok: z.boolean(),
      data: z.unknown().optional(),
      error: z
        .object({
          code: z.string(),
          message: z.string().optional(),
          field: z.string().optional(),
        })
        .optional(),
    })
    .parse(await response.json());
  if (!response.ok || !envelope.ok)
    throw new CloudError(
      envelope.error?.code ?? "worker_config_failed",
      envelope.error?.code === "validation_failed"
        ? envelope.error.message
        : undefined,
      envelope.error?.code === "validation_failed"
        ? envelope.error.field
        : undefined,
    );
  return envelope.data;
}
