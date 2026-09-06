import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
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

    const job = await getJob(id);

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    if (
      job.status === "paused" ||
      job.status === "stopped" ||
      job.status === "completed" ||
      job.status === "failed"
    ) {
      return NextResponse.json(
        {
          error: `Job cannot run while status is "${job.status}"`
        },
        { status: 409 }
      );
    }

    let body: {
      workerId?: string;
      operationsPerStep?: number;
      maxSteps?: number;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Empty request body is allowed.
    }

    const workerId =
      body.workerId ??
      request.headers.get("x-worker-id") ??
      undefined;

    const operationsPerStep =
      body.operationsPerStep ?? 1000;

    const maxSteps =
      body.maxSteps ?? 100;

    if (
      !Number.isSafeInteger(operationsPerStep) ||
      operationsPerStep <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid operationsPerStep" },
        { status: 400 }
      );
    }

    if (
      !Number.isSafeInteger(maxSteps) ||
      maxSteps <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid maxSteps" },
        { status: 400 }
      );
    }

    const result = await runWorker({
      jobId: id,
      workerId,
      operationsPerStep,
      maxSteps
    });

    return NextResponse.json({
      success: true,
      jobId: id,
      worker: result
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
