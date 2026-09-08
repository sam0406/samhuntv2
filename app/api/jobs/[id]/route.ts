import { NextResponse } from "next/server";
import { getJob, updateJobStatus } from "@/lib/jobs";
import { getChunksForJob } from "@/lib/queue";
import { sql } from "@/lib/db";
import type { JobStatus } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

function serializeJob(job: any) {
  return {
    ...job,
    processed: String(job.processed),
    total_chunks: Number(job.total_chunks),
    completed_chunks: Number(job.completed_chunks),
    chunk_size: Number(job.chunk_size),
  };
}

function serializeChunk(chunk: any) {
  return {
    ...chunk,
    processed: String(chunk.processed),
    chunk_index: Number(chunk.chunk_index),
    throughput:
      chunk.throughput === null ||
      chunk.throughput === undefined
        ? null
        : Number(chunk.throughput),
  };
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        error: "Job ID is required",
      },
      { status: 400 },
    );
  }

  try {
    const job = await getJob(id);

    if (!job) {
      return NextResponse.json(
        {
          ok: false,
          error: "Job not found",
        },
        { status: 404 },
      );
    }

    const chunks = await getChunksForJob(id);

    const logs = await sql`
      SELECT
        id,
        job_id,
        chunk_id,
        level,
        event,
        message,
        details,
        created_at
      FROM job_logs
      WHERE job_id = ${id}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      ok: true,
      job: serializeJob(job),
      chunks: chunks.map(serializeChunk),
      logs,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

interface PatchBody {
  status?: JobStatus;
  stopReason?: string | null;
  error?: string | null;
  checkpoint?: string | null;
}

const allowedTransitions: Record<
  JobStatus,
  JobStatus[]
> = {
  queued: ["running", "stopped"],
  running: ["paused", "completed", "failed", "stopped"],
  paused: ["running", "stopped"],
  completed: [],
  failed: [],
  stopped: [],
};

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        error: "Job ID is required",
      },
      { status: 400 },
    );
  }

  let body: PatchBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Request body must be valid JSON",
      },
      { status: 400 },
    );
  }

  if (!body.status) {
    return NextResponse.json(
      {
        ok: false,
        error: "status is required",
      },
      { status: 400 },
    );
  }

  const currentJob = await getJob(id);

  if (!currentJob) {
    return NextResponse.json(
      {
        ok: false,
        error: "Job not found",
      },
      { status: 404 },
    );
  }

  const allowed = allowedTransitions[currentJob.status];

  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Cannot change job status from ${currentJob.status} to ${body.status}`,
      },
      { status: 409 },
    );
  }

  try {
    const job = await updateJobStatus(id, body.status, {
      stopReason: body.stopReason,
      error: body.error,
      checkpoint: body.checkpoint,
    });

    if (!job) {
      return NextResponse.json(
        {
          ok: false,
          error: "Job not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      job: serializeJob(job),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
