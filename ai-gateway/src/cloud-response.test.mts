// @vitest-environment node
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { CloudError, readCloudResponse } from "./cloud-response.mts";

it("BOT-07 워커와 같은 strip-only 실행에서 오류 모듈을 읽어요", () => {
  const moduleUrl = new URL("./cloud-response.mts", import.meta.url).href;
  const output = execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      `const { CloudError } = await import(${JSON.stringify(moduleUrl)});
       const error = new CloudError("validation_failed", "detail", "field");
       console.log(JSON.stringify({ message: error.message, detail: error.detail, field: error.field }));`,
    ],
    { encoding: "utf8" },
  );
  expect(JSON.parse(output)).toEqual({
    message: "validation_failed",
    detail: "detail",
    field: "field",
  });
});

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
