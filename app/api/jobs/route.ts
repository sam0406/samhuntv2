import { NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { createChunks } from "@/lib/queue";
import { getPuzzleFixture } from "@/lib/puzzles";
import { sql } from "@/lib/db";
import { writeLog } from "@/lib/logger";

interface CreateJobBody {
  puzzleId?: number | null;
  rangeStart: string;
  rangeEnd: string;
  chunkSize: number;
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

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        id,
        puzzle_id,
        status,
        range_start,
        range_end,
        chunk_size,
        total_chunks,
        completed_chunks,
        processed,
        started_at,
        finished_at,
        last_checkpoint,
        stop_reason,
        error,
        created_at,
        updated_at
      FROM jobs
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const jobs = rows.map(serializeJob);

    return NextResponse.json({
      ok: true,
      jobs,
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

export async function POST(request: Request) {
  let body: CreateJobBody;

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

  if (
    typeof body.rangeStart !== "string" ||
    typeof body.rangeEnd !== "string"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "rangeStart and rangeEnd are required strings",
      },
      { status: 400 },
    );
  }

  if (
    !Number.isSafeInteger(body.chunkSize) ||
    body.chunkSize <= 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "chunkSize must be a positive safe integer",
      },
      { status: 400 },
    );
  }

  let rangeStart: bigint;
  let rangeEnd: bigint;

  try {
    rangeStart = BigInt(body.rangeStart);
    rangeEnd = BigInt(body.rangeEnd);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "rangeStart and rangeEnd must be valid integers",
      },
      { status: 400 },
    );
  }

  if (rangeEnd < rangeStart) {
    return NextResponse.json(
      {
        ok: false,
        error: "rangeEnd must be greater than or equal to rangeStart",
      },
      { status: 400 },
    );
  }

  if (
    body.puzzleId !== undefined &&
    body.puzzleId !== null &&
    (!Number.isSafeInteger(body.puzzleId) ||
      body.puzzleId <= 0)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "puzzleId must be a positive integer",
      },
      { status: 400 },
    );
  }

  /*
   * Benchmark fixture validation.
   *
   * We deliberately validate against the public benchmark fixture
   * rather than accepting arbitrary key-search parameters.
   */
  if (body.puzzleId !== undefined && body.puzzleId !== null) {
    const puzzle = getPuzzleFixture(body.puzzleId);

    if (!puzzle) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unknown benchmark puzzle",
        },
        { status: 400 },
      );
    }

    const fixtureStart = BigInt(puzzle.rangeStart);
    const fixtureEnd = BigInt(puzzle.rangeEnd);

    if (
      rangeStart < fixtureStart ||
      rangeEnd > fixtureEnd
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Requested range must remain inside the selected benchmark fixture range",
        },
        { status: 400 },
      );
    }
  }

  let job;

  try {
    job = await createJob({
      puzzleId: body.puzzleId ?? null,
      rangeStart: rangeStart.toString(),
      rangeEnd: rangeEnd.toString(),
      chunkSize: body.chunkSize,
    });

    await createChunks({
      jobId: String(job.id),
      rangeStart: rangeStart.toString(),
      rangeEnd: rangeEnd.toString(),
      chunkSize: body.chunkSize,
    });

    await writeLog({
      jobId: String(job.id),
      event: "job_initialized",
      message: "Job chunks initialized successfully",
      details: {
        puzzleId: body.puzzleId ?? null,
        rangeStart: rangeStart.toString(),
        rangeEnd: rangeEnd.toString(),
        chunkSize: body.chunkSize,
      },
    });

    const refreshedRows = await sql`
      SELECT
        id,
        puzzle_id,
        status,
        range_start,
        range_end,
        chunk_size,
        total_chunks,
        completed_chunks,
        processed,
        started_at,
        finished_at,
        last_checkpoint,
        stop_reason,
        error,
        created_at,
        updated_at
      FROM jobs
      WHERE id = ${job.id}
      LIMIT 1
    `;

    const refreshedJob =
      refreshedRows.length > 0
        ? refreshedRows[0]
        : job;

    return NextResponse.json(
      {
        ok: true,
        job: serializeJob(refreshedJob),
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (job?.id) {
      try {
        await writeLog({
          jobId: String(job.id),
          level: "error",
          event: "job_initialization_failed",
          message: "Failed to initialize job chunks",
          details: {
            error: message,
          },
        });
      } catch {
        // Preserve the original initialization error.
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: message,
        jobId: job?.id ?? null,
      },
      { status: 500 },
    );
  }
}
