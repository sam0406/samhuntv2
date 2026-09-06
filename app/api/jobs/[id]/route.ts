import { NextRequest, NextResponse } from "next/server";
import {
  getJob,
  updateJobStatus
} from "@/lib/jobs";
import { getJobLogs } from "@/lib/logger";
interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}
const controllableStatuses = [
  "paused",
  "stopped"
] as const;
function isControllableStatus(
  value: unknown
): value is (typeof controllableStatuses)[number] {
  return (
    typeof value === "string" &&
    controllableStatuses.includes(
      value as (typeof controllableStatuses)[number]
    )
  );
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
    const logs = await getJobLogs(
      id,
      100
    );
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
    const requestedStatus =
      body.status;
    if (
      !isControllableStatus(
        requestedStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Only paused and stopped can be requested through this endpoint."
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
    if (
      job.status === "completed" ||
      job.status === "failed"
    ) {
      return NextResponse.json(
        {
          error:
            `Job cannot be changed because it is already ${job.status}`
        },
        { status: 409 }
      );
    }
    if (
      job.status === requestedStatus
    ) {
      return NextResponse.json({
        job
      });
    }
    const stopReason =
      requestedStatus === "stopped"
        ? String(
            body.reason ??
              "Stopped by user"
          )
        : null;
    const updatedJob =
      await updateJobStatus(
        id,
        requestedStatus,
        {
          stopReason
        }
      );
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
