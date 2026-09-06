import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getJob } from "@/lib/jobs";

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

    const chunks = await sql`
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
    `;

    return NextResponse.json({
      jobId: id,
      chunks
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
