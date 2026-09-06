import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { createChunks } from "@/lib/queue";
import { getPuzzleFixture, validatePuzzleRange } from "@/lib/puzzles";
import { writeLog } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const puzzleId = Number(body.puzzleId);
    const rangeStart = String(body.rangeStart ?? "");
    const rangeEnd = String(body.rangeEnd ?? "");
    const chunkSize = Number(body.chunkSize);

    if (!Number.isInteger(puzzleId)) {
      return NextResponse.json(
        { error: "Invalid puzzleId" },
        { status: 400 }
      );
    }

    if (!rangeStart || !rangeEnd) {
      return NextResponse.json(
        { error: "rangeStart and rangeEnd are required" },
        { status: 400 }
      );
    }

    if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
      return NextResponse.json(
        { error: "chunkSize must be a positive safe integer" },
        { status: 400 }
      );
    }

    // Validate that the selected puzzle exists.
    const puzzle = getPuzzleFixture(puzzleId);

    if (!puzzle) {
      return NextResponse.json(
        { error: `Puzzle ${puzzleId} is not available` },
        { status: 404 }
      );
    }

    // Validate hexadecimal/numeric range syntax.
    try {
      BigInt(rangeStart);
      BigInt(rangeEnd);
    } catch {
      return NextResponse.json(
        { error: "Invalid range format" },
        { status: 400 }
      );
    }

    if (!validatePuzzleRange(puzzle, rangeStart, rangeEnd)) {
      return NextResponse.json(
        {
          error: "Requested range is outside the benchmark fixture range"
        },
        { status: 400 }
      );
    }

    const job = await createJob({
      puzzleId,
      rangeStart,
      rangeEnd,
      chunkSize
    });

    try {
      await createChunks({
        jobId: job.id,
        rangeStart,
        rangeEnd,
        chunkSize
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      await writeLog({
        jobId: job.id,
        level: "error",
        event: "chunk_creation_failed",
        message
      });

      return NextResponse.json(
        {
          error: "Job created but chunk creation failed",
          jobId: job.id
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        job,
        puzzle: {
          id: puzzle.id,
          name: puzzle.name,
          address: puzzle.address,
          rangeStart: puzzle.rangeStart,
          rangeEnd: puzzle.rangeEnd
        }
      },
      { status: 201 }
    );
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

export async function GET() {
  try {
    const { sql } = await import("@/lib/db");

    const jobs = await sql`
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

    return NextResponse.json({ jobs });
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
