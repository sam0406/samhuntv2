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
/**
 * Re-queue chunks left in "running" state by a worker that disappeared.
 *
 * The checkpoint remains intact, so a future worker can resume from it.
 */
export async function recoverStaleChunks(
  jobId: string,
  staleSeconds = 300
): Promise<number> {
  if (!Number.isInteger(staleSeconds) || staleSeconds <= 0) {
    throw new Error("staleSeconds must be a positive integer");
  }
  const rows = await sql`
    UPDATE chunks
    SET
      status = 'queued',
      worker_id = NULL,
      error = NULL
    WHERE
      job_id = ${jobId}
      AND status = 'running'
      AND started_at IS NOT NULL
      AND started_at < NOW() - (${staleSeconds} * INTERVAL '1 second')
    RETURNING id, chunk_index
  `;
  if (rows.length > 0) {
    await writeLog({
      jobId,
      event: "stale_chunks_recovered",
      message: `Recovered ${rows.length} stale chunk(s)`,
      details: {
        staleSeconds,
        chunks: rows.map((row) => ({
          id: row.id,
          chunkIndex: row.chunk_index
        }))
      }
    });
  }
  return rows.length;
}
/**
 * Claims the next queued chunk.
 *
 * If the chunk already has a checkpoint, the worker must resume after it.
 */
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
      started_at = NOW(),
      error = NULL
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
        rangeEnd: chunk.range_end,
        checkpoint: chunk.last_checkpoint
      }
    });
  }
  return chunk;
}
/**
 * Persist progress for a running chunk.
 *
 * The checkpoint represents the last benchmark value successfully processed.
 */
export async function updateChunkProgress(
  chunkId: string,
  processed: number,
  checkpoint: string
): Promise<void> {
  if (!Number.isSafeInteger(processed) || processed < 0) {
    throw new Error(
      "processed must be a non-negative safe integer"
    );
  }
  await sql`
    UPDATE chunks
    SET
      processed = ${processed},
      last_checkpoint = ${checkpoint}
    WHERE
      id = ${chunkId}
      AND status = 'running'
  `;
}
/**
 * Release a partially processed chunk back to the queue.
 *
 * The checkpoint is deliberately preserved.
 */
export async function releaseChunk(
  chunkId: string
): Promise<void> {
  const rows = await sql`
    UPDATE chunks
    SET
      status = 'queued',
      worker_id = NULL
    WHERE
      id = ${chunkId}
      AND status = 'running'
    RETURNING job_id, chunk_index
  `;
  const row = rows[0] as
    | {
        job_id: string;
        chunk_index: number;
      }
    | undefined;
  if (!row) {
    throw new Error(
      `Chunk ${chunkId} could not be released`
    );
  }
  await writeLog({
    jobId: row.job_id,
    chunkId,
    event: "chunk_released",
    message: `Chunk ${row.chunk_index} returned to queue`,
    details: {
      reason: "worker_step_limit"
    }
  });
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
    WHERE
      id = ${chunkId}
      AND status = 'running'
    RETURNING job_id
  `;
  const row = rows[0] as
    | {
        job_id: string;
      }
    | undefined;
  if (!row) {
    throw new Error(
      `Chunk ${chunkId} could not be completed`
    );
  }
  await sql`
    UPDATE jobs
    SET
      completed_chunks = completed_chunks + 1,
      updated_at = NOW()
    WHERE id = ${row.job_id}
  `;
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
    WHERE
      id = ${chunkId}
      AND status = 'running'
    RETURNING job_id
  `;
  const row = rows[0] as
    | {
        job_id: string;
      }
    | undefined;
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
