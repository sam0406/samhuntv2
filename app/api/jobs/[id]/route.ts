import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
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
        {
          ok: false,
          error: "Job not found",
        },
        { status: 404 }
      );
    }

    /*
     * Return the individual chunks so the dashboard can show
     * exactly which range each processed chunk covered.
     */
    const chunkRows = await sql`
      SELECT
        id,
        job_id,
        chunk_index,
        range_start,
        range_end,
        status,
        processed,
        worker_id,
        started_at,
        completed_at,
        last_checkpoint,
        throughput,
        error,
        created_at
      FROM chunks
      WHERE job_id = ${id}
      ORDER BY chunk_index ASC
      LIMIT 1000
    `;

    const chunks = chunkRows.map((row) => ({
      id: String(row.id),
      job_id: String(row.job_id),
      chunk_index: Number(row.chunk_index),
      range_start: String(row.range_start),
      range_end: String(row.range_end),
      status: String(row.status),
      processed: Number(row.processed ?? 0),
      worker_id: row.worker_id
        ? String(row.worker_id)
        : null,
      started_at: row.started_at
        ? new Date(row.started_at as string).toISOString()
        : null,
      completed_at: row.completed_at
        ? new Date(row.completed_at as string).toISOString()
        : null,
      last_checkpoint: row.last_checkpoint
        ? String(row.last_checkpoint)
        : null,
      throughput:
        row.throughput === null ||
        row.throughput === undefined
          ? null
          : Number(row.throughput),
      error: row.error
        ? String(row.error)
        : null,
      created_at: new Date(
        row.created_at as string
      ).toISOString(),
    }));

    const logs = await getJobLogs(id, 100);

    return NextResponse.json({
      ok: true,
      job,
      chunks,
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
      !allowedStatuses.includes(
        requestedStatus as JobStatus
      )
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
        {
          ok: false,
          error: "Job not found",
        },
        { status: 404 }
      );
    }

    const currentStatus =
      job.status as JobStatus;

    const nextStatus =
      requestedStatus as JobStatus;

    if (currentStatus === nextStatus) {
      return NextResponse.json({
        ok: true,
        job,
      });
    }

    if (
      !transitions[currentStatus].includes(
        nextStatus
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Invalid status transition: ` +
            `${currentStatus} → ${nextStatus}`,
        },
        { status: 409 }
      );
    }

    const updatedJob =
      await updateJobStatus(
        id,
        nextStatus
      );

    return NextResponse.json({
      ok: true,
      job: updatedJob,
    });
  } catch (error) {
    console.error(
      "Failed to update job:",
      error
    );

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
