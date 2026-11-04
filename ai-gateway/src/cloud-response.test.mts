// @vitest-environment node
import { expect, it } from "vitest";
import { CloudError, readCloudResponse } from "./cloud-response.mts";

it("BOT-07 검증 실패의 고정 문구와 필드만 워커 진단에 전달해요", async () => {
  const response = Response.json(
    {
      ok: false,
      error: {
        code: "validation_failed",
        message: "카테고리를 선택해 주세요.",
        field: "actions.0.payload.event.categoryId",
        value: "PRIVATE_VALUE",
      },
    },
    { status: 400 },
  );
  const error = await readCloudResponse(response).catch(
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(CloudError);
  expect(error).toMatchObject({
    message: "validation_failed",
    detail: "카테고리를 선택해 주세요.",
    field: "actions.0.payload.event.categoryId",
  });
  expect(JSON.stringify(error)).not.toContain("PRIVATE_VALUE");
  await expect(
    readCloudResponse(
      Response.json(
        {
          ok: false,
          error: {
            code: "forbidden",
            message: "PRIVATE_VALUE",
            field: "PRIVATE_FIELD",
          },
        },
        { status: 403 },
      ),
    ),
  ).rejects.toMatchObject({
    message: "forbidden",
    detail: undefined,
    field: undefined,
  });
  await expect(
    readCloudResponse(Response.json({ ok: true, data: { id: "result" } })),
  ).resolves.toEqual({ id: "result" });
});
