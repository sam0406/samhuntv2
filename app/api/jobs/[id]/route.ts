import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJobStatus } from "@/lib/jobs";
import { getJobLogs } from "@/lib/logger";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  _request: NextRequest,
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

    const logs = await getJobLogs(id, 100);

    return NextResponse.json({
      job,
      logs
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const status = body.status;

    const allowedStatuses = [
      "queued",
      "running",
      "paused",
      "stopped"
    ];

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Allowed values: queued, running, paused, stopped"
        },
        { status: 400 }
      );
    }

    const job = await getJob(id);

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    const updatedJob = await updateJobStatus(id, status, {
      stopReason:
        status === "stopped"
          ? String(body.reason ?? "Stopped by user")
          : null
    });

    return NextResponse.json({
      job: updatedJob
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
