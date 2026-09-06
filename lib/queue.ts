import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import type { Chunk } from "@/lib/types";
import { writeLog } from "@/lib/logger";

interface CreateChunksParams {
  jobId: string;
  rangeStart: string;
  rangeEnd: string;
  chunkSize: number;
}

export async function createChunks({
  jobId,
  rangeStart,
  rangeEnd,
  chunkSize
}: CreateChunksParams): Promise<number> {
  const start = BigInt(rangeStart);
  const end = BigInt(rangeEnd);
  const size = BigInt(chunkSize);

  if (end < start) {
    throw new Error("rangeEnd must be greater than or equal to rangeStart");
  }

  if (size <= 0n) {
    throw new Error("chunkSize must be greater than zero");
  }

  let current = start;
  let index = 0;

  while (current <= end) {
    const chunkEnd =
      current + size - 1n < end
        ? current + size - 1n
        : end;

    await sql`
      INSERT INTO chunks (
        id,
        job_id,
        chunk_index,
        range_start,
        range_end,
        status
      )
      VALUES (
        ${randomUUID()},
        ${jobId},
        ${index},
        ${current.toString()},
        ${chunkEnd.toString()},
        'queued'
      )
      ON CONFLICT (job_id, chunk_index) DO NOTHING
    `;

    current = chunkEnd + 1n;
    index++;
  }

  await writeLog({
    jobId,
    event: "chunks_created",
    message: `Created ${index} chunks`,
    details: {
      totalChunks: index,
      rangeStart,
      rangeEnd,
      chunkSize
    }
  });

  return index;
}

export async function claimNextChunk(
  jobId: string,
  workerId?: string
): Promise<Chunk | null> {
  const id = workerId ?? randomUUID();

  const rows = await sql`
    WITH next_chunk AS (
      SELECT id
      FROM chunks
      WHERE
        job_id = ${jobId}
        AND status = 'queued'
      ORDER BY chunk_index
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE chunks
    SET
      status = 'running',
      worker_id = ${id},
      started_at = NOW()
    WHERE id IN (
      SELECT id FROM next_chunk
    )
    RETURNING
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
  `;

  const chunk = (rows[0] as Chunk | undefined) ?? null;

  if (chunk) {
    await writeLog({
      jobId,
      chunkId: chunk.id,
      event: "chunk_claimed",
      message: `Chunk ${chunk.chunk_index} claimed`,
      details: {
        workerId: id,
        rangeStart: chunk.range_start,
        rangeEnd: chunk.range_end
      }
    });
  }

  return chunk;
}

export async function completeChunk(
  chunkId: string,
  processed: number,
  checkpoint?: string | null,
  throughput?: number | null
): Promise<void> {
  const rows = await sql`
    UPDATE chunks
    SET
      status = 'completed',
      processed = ${processed},
      last_checkpoint = ${checkpoint ?? null},
      throughput = ${throughput ?? null},
      completed_at = NOW()
    WHERE id = ${chunkId}
    RETURNING job_id
  `;

  const row = rows[0] as { job_id: string } | undefined;

  if (row) {
    await writeLog({
      jobId: row.job_id,
      chunkId,
      event: "chunk_completed",
      message: "Chunk completed",
      details: {
        processed,
        checkpoint: checkpoint ?? null,
        throughput: throughput ?? null
      }
    });
  }
}

export async function failChunk(
  chunkId: string,
  error: string
): Promise<void> {
  const rows = await sql`
    UPDATE chunks
    SET
      status = 'failed',
      error = ${error},
      completed_at = NOW()
    WHERE id = ${chunkId}
    RETURNING job_id
  `;

  const row = rows[0] as { job_id: string } | undefined;

  if (row) {
    await writeLog({
      jobId: row.job_id,
      chunkId,
      level: "error",
      event: "chunk_failed",
      message: error
    });
  }
}
