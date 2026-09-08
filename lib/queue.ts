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

interface ClaimedChunk extends Chunk {}

function validateRange(
  rangeStart: string,
  rangeEnd: string,
  chunkSize: number,
): void {
  const start = BigInt(rangeStart);
  const end = BigInt(rangeEnd);

  if (end < start) {
    throw new Error("rangeEnd must be greater than or equal to rangeStart");
  }

  if (chunkSize <= 0 || !Number.isSafeInteger(chunkSize)) {
    throw new Error("chunkSize must be a positive safe integer");
  }
}

export async function createChunks({
  jobId,
  rangeStart,
  rangeEnd,
  chunkSize,
}: CreateChunksParams): Promise<number> {
  validateRange(rangeStart, rangeEnd, chunkSize);

  const start = BigInt(rangeStart);
  const end = BigInt(rangeEnd);
  const size = BigInt(chunkSize);

  let chunkIndex = 0;
  let current = start;

  while (current <= end) {
    const chunkEnd =
      current + size - 1n <= end ? current + size - 1n : end;

    const chunkId = randomUUID();

    await sql`
      INSERT INTO chunks (
        id,
        job_id,
        chunk_index,
        range_start,
        range_end,
        status,
        processed
      )
      VALUES (
        ${chunkId},
        ${jobId},
        ${chunkIndex},
        ${current.toString()},
        ${chunkEnd.toString()},
        'queued',
        0
      )
    `;

    current = chunkEnd + 1n;
    chunkIndex += 1;
  }

  await writeLog({
    jobId,
    event: "chunks_created",
    message: `Created ${chunkIndex} benchmark chunks`,
    details: {
      rangeStart,
      rangeEnd,
      chunkSize,
      totalChunks: chunkIndex,
    },
  });

  return chunkIndex;
}

export async function recoverStaleChunks(
  jobId: string,
  staleSeconds = 300,
): Promise<number> {
  if (!Number.isFinite(staleSeconds) || staleSeconds <= 0) {
    throw new Error("staleSeconds must be greater than zero");
  }

  const rows = await sql`
    UPDATE chunks
    SET
      status = 'queued',
      worker_id = NULL,
      updated_at = NOW()
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
      message: `Recovered ${rows.length} stale chunks`,
      details: {
        count: rows.length,
        staleSeconds,
      },
    });
  }

  return rows.length;
}

export async function claimNextChunk(
  jobId: string,
  workerId: string,
): Promise<ClaimedChunk | null> {
  if (!workerId) {
    throw new Error("workerId is required");
  }

  const rows = await sql`
    WITH next_chunk AS (
      SELECT id
      FROM chunks
      WHERE
        job_id = ${jobId}
        AND status = 'queued'
      ORDER BY chunk_index ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE chunks AS c
    SET
      status = 'running',
      worker_id = ${workerId},
      started_at = COALESCE(c.started_at, NOW()),
      updated_at = NOW()
    FROM next_chunk
    WHERE c.id = next_chunk.id
    RETURNING
      c.id,
      c.job_id,
      c.chunk_index,
      c.range_start,
      c.range_end,
      c.status,
      c.processed,
      c.worker_id,
      c.started_at,
      c.completed_at,
      c.last_checkpoint,
      c.throughput,
      c.error,
      c.created_at,
      c.updated_at
  `;

  if (rows.length === 0) {
    return null;
  }

  const chunk = rows[0] as Chunk;

  await writeLog({
    jobId,
    chunkId: chunk.id,
    event: "chunk_claimed",
    message: `Chunk ${chunk.chunk_index} claimed by ${workerId}`,
    details: {
      chunkIndex: chunk.chunk_index,
      rangeStart: chunk.range_start,
      rangeEnd: chunk.range_end,
      workerId,
      processed: chunk.processed,
      lastCheckpoint: chunk.last_checkpoint,
    },
  });

  return chunk;
}

/**
 * Atomically update both the chunk and its parent job.
 *
 * This prevents the following failure mode:
 *
 *   chunk progress succeeds
 *   job progress fails
 *   worker retries
 *   job progress gets counted twice
 *
 * Both counters and checkpoints are updated by one SQL statement.
 */
export async function updateProgressAtomically(
  chunkId: string,
  workerId: string,
  processedDelta: number | string,
  checkpoint: string,
  throughput?: number | null,
): Promise<void> {
  const delta = BigInt(processedDelta);

  if (delta <= 0n) {
    throw new Error("processedDelta must be greater than zero");
  }

  if (!workerId) {
    throw new Error("workerId is required");
  }

  const rows = await sql`
    WITH updated_chunk AS (
      UPDATE chunks
      SET
        processed = processed + ${delta.toString()}::bigint,
        last_checkpoint = ${checkpoint},
        throughput = ${throughput ?? null},
        updated_at = NOW()
      WHERE
        id = ${chunkId}
        AND status = 'running'
        AND worker_id = ${workerId}
      RETURNING
        job_id,
        processed,
        last_checkpoint
    )
    UPDATE jobs AS j
    SET
      processed = j.processed + ${delta.toString()}::bigint,
      last_checkpoint = ${checkpoint},
      updated_at = NOW()
    FROM updated_chunk
    WHERE j.id = updated_chunk.job_id
    RETURNING
      j.id AS job_id,
      j.processed,
      j.last_checkpoint
  `;

  if (rows.length === 0) {
    throw new Error(
      "Progress update rejected: chunk was not running or is no longer owned by this worker",
    );
  }
}

export async function releaseChunk(
  chunkId: string,
  checkpoint?: string | null,
): Promise<void> {
  const checkpointValue = checkpoint ?? null;

  const rows = await sql`
    UPDATE chunks
    SET
      status = 'queued',
      worker_id = NULL,
      last_checkpoint =
        CASE
          WHEN ${checkpointValue}::text IS NOT NULL
            THEN ${checkpointValue}::text
          ELSE last_checkpoint
        END,
      updated_at = NOW()
    WHERE id = ${chunkId}
    RETURNING job_id, chunk_index
  `;

  if (rows.length === 0) {
    return;
  }

  await writeLog({
    jobId: String(rows[0].job_id),
    chunkId,
    event: "chunk_released",
    message: `Chunk ${rows[0].chunk_index} released back to the queue`,
    details: {
      checkpoint: checkpointValue,
    },
  });
}

export async function completeChunk(
  chunkId: string,
  checkpoint?: string | null,
): Promise<void> {
  const checkpointValue = checkpoint ?? null;

  const rows = await sql`
    WITH completed AS (
      UPDATE chunks
      SET
        status = 'completed',
        worker_id = NULL,
        completed_at = NOW(),
        last_checkpoint =
          CASE
            WHEN ${checkpointValue}::text IS NOT NULL
              THEN ${checkpointValue}::text
            ELSE last_checkpoint
          END,
        updated_at = NOW()
      WHERE
        id = ${chunkId}
        AND status <> 'completed'
      RETURNING job_id, chunk_index
    )
    UPDATE jobs AS j
    SET
      completed_chunks = j.completed_chunks + 1,
      updated_at = NOW()
    FROM completed
    WHERE j.id = completed.job_id
    RETURNING
      j.id AS job_id,
      completed.chunk_index
  `;

  if (rows.length === 0) {
    return;
  }

  await writeLog({
    jobId: String(rows[0].job_id),
    chunkId,
    event: "chunk_completed",
    message: `Chunk ${rows[0].chunk_index} completed`,
    details: {
      checkpoint: checkpointValue,
    },
  });
}

export async function failChunk(
  chunkId: string,
  error: string,
): Promise<void> {
  const rows = await sql`
    UPDATE chunks
    SET
      status = 'failed',
      worker_id = NULL,
      error = ${error},
      updated_at = NOW()
    WHERE id = ${chunkId}
    RETURNING job_id, chunk_index
  `;

  if (rows.length === 0) {
    return;
  }

  await writeLog({
    jobId: String(rows[0].job_id),
    chunkId,
    level: "error",
    event: "chunk_failed",
    message: `Chunk ${rows[0].chunk_index} failed`,
    details: {
      error,
    },
  });
}

export async function getChunksForJob(jobId: string): Promise<Chunk[]> {
  const rows = await sql`
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
      created_at,
      updated_at
    FROM chunks
    WHERE job_id = ${jobId}
    ORDER BY chunk_index ASC
  `;

  return rows.map((row) => ({
    ...row,
    processed: String(row.processed),
    chunk_index: Number(row.chunk_index),
    throughput:
      row.throughput === null || row.throughput === undefined
        ? null
        : Number(row.throughput),
  })) as Chunk[];
}
