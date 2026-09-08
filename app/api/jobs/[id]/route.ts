import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJobStatus } from "@/lib/jobs";
import { getJobLogs } from "@/lib/logger";
type RouteContext = {
  params: Promise<{ id: string }>;
};
const allowedStatuses = [
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "stopped",
] as const;
type JobStatus = (typeof allowedStatuses)[number];
const transitions: Record<JobStatus, JobStatus[]> = {
  queued: ["running", "paused", "stopped"],
  running: ["paused", "stopped", "completed", "failed"],
  paused: ["running", "stopped"],
  completed: [],
  failed: [],
  stopped: [],
};
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const job = await getJob(id);
    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Job not found" },
        { status: 404 }
      );
    }
    const logs = await getJobLogs(id, 100);
    return NextResponse.json({
      ok: true,
      job,
      logs,
    });
  } catch (error) {
    console.error("Failed to get job:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get job",
      },
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
    const requestedStatus = body?.status;
    if (
      typeof requestedStatus !== "string" ||
      !allowedStatuses.includes(requestedStatus as JobStatus)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid job status",
        },
        { status: 400 }
      );
    }
    const job = await getJob(id);
    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Job not found" },
        { status: 404 }
      );
    }
    const currentStatus = job.status as JobStatus;
    const nextStatus = requestedStatus as JobStatus;
    if (currentStatus === nextStatus) {
      return NextResponse.json({
        ok: true,
        job,
      });
    }
    if (!transitions[currentStatus].includes(nextStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid status transition: ${currentStatus} → ${nextStatus}`,
        },
        { status: 409 }
      );
    }
    const updatedJob = await updateJobStatus(id, nextStatus);
    return NextResponse.json({
      ok: true,
      job: updatedJob,
    });
  } catch (error) {
    console.error("Failed to update job:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update job",
      },
      { status: 500 }
    );
  }
}
