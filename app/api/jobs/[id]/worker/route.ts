import { NextRequest, NextResponse } from "next/server";
import { runWorker } from "@/lib/worker";
interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const workerId =
      typeof body.workerId === "string" &&
      body.workerId.trim().length > 0
        ? body.workerId.trim()
        : `vercel-worker-${crypto.randomUUID()}`;
    const operationsPerStep =
      body.operationsPerStep === undefined
        ? 1000
        : Number(body.operationsPerStep);
    const maxSteps =
      body.maxSteps === undefined
        ? 100
        : Number(body.maxSteps);
    const staleSeconds =
      body.staleSeconds === undefined
        ? 300
        : Number(body.staleSeconds);
    if (
      !Number.isInteger(operationsPerStep) ||
      operationsPerStep < 1 ||
      operationsPerStep > 100_000
    ) {
      return NextResponse.json(
        {
          error:
            "operationsPerStep must be an integer between 1 and 100000"
        },
        { status: 400 }
      );
    }
    if (
      !Number.isInteger(maxSteps) ||
      maxSteps < 1 ||
      maxSteps > 10_000
    ) {
      return NextResponse.json(
        {
          error:
            "maxSteps must be an integer between 1 and 10000"
        },
        { status: 400 }
      );
    }
    if (
      !Number.isInteger(staleSeconds) ||
      staleSeconds < 30 ||
      staleSeconds > 86_400
    ) {
      return NextResponse.json(
        {
          error:
            "staleSeconds must be an integer between 30 and 86400"
        },
        { status: 400 }
      );
    }
    const result = await runWorker({
      jobId: id,
      workerId,
      operationsPerStep,
      maxSteps,
      staleSeconds
    });
    return NextResponse.json({
      ok: true,
      result
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}
