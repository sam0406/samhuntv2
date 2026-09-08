import { NextRequest, NextResponse } from "next/server";
import { runWorker } from "@/lib/worker";
type RouteContext = {
  params: Promise<{ id: string }>;
};
export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing job id" },
        { status: 400 }
      );
    }
    const result = await runWorker({
      jobId: id,
    });
    return NextResponse.json({
      ok: true,
      worker: result,
    });
  } catch (error) {
    console.error("Worker execution failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Worker execution failed",
      },
      { status: 500 }
    );
  }
}
