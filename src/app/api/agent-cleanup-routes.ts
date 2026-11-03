import "server-only";
import { NextResponse } from "next/server";
import { ApiError } from "@/shared/api";
import { cleanupAgentFiles } from "@/entities/chat-message/index.server";
export async function agentCleanupPOST(request: Request) {
  try {
    return NextResponse.json(
      { ok: true, data: await cleanupAgentFiles(request) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error instanceof ApiError ? error.code : "cleanup_failed",
          message: "사진 정리를 완료하지 못했어요.",
        },
      },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}
