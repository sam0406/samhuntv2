import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import type { Job, JobStatus } from "@/lib/types";
import { writeLog } from "@/lib/logger";
interface CreateJobParams {
  puzzleId?: number | null;
  rangeStart: string;
  rangeEnd: string;
  chunkSize: number;
}
function calculateTotalChunks(
  rangeStart: string,
  rangeEnd: string,
  chunkSize: number
): number {
  const start = BigInt(rangeStart);
  const end = BigInt(rangeEnd);
  const size = BigInt(chunkSize);
  if (end < start) {
    throw new Error(
      "rangeEnd must be greater than or equal to rangeStart"
    );
  }
  if (size <= 0n) {
    throw new Error(
      "chunkSize must be greater than zero"
    );
  }
  const count = end - start + 1n;
  const chunks = (count + size - 1n) / size;
  if (
    chunks >
    BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error(
      "Too many chunks for this job"
    );
  }
  return Number(chunks);
}
export async function createJob({
  puzzleId = null,
  rangeStart,
  rangeEnd,
  chunkSize
}: CreateJobParams): Promise<Job> {
  const totalChunks =
    calculateTotalChunks(
      rangeStart,
      rangeEnd,
      chunkSize
    );
  const jobId = randomUUID();
  const rows = await sql`
    INSERT INTO jobs (
      id,
      puzzle_id,
      status,
      range_start,
      range_end,
      chunk_size,
      total_chunks
    )
    VALUES (
      ${jobId},
      ${puzzleId},
      'queued',
      ${rangeStart},
      ${rangeEnd},
      ${chunkSize},
      ${totalChunks}
    )
    RETURNING
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
  `;
  const job = rows[0] as Job;
  await writeLog({
    jobId,
    event: "job_created",
    message: "Job created",
    details: {
      puzzleId,
      rangeStart,
      rangeEnd,
      chunkSize,
      totalChunks
    }
  });
  return job;
}
export async function getJob(
  jobId: string
): Promise<Job | null> {
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
    WHERE id = ${jobId}
    LIMIT 1
  `;
  return (
    (rows[0] as Job | undefined) ??
    null
  );
}
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  options: {
    stopReason?: string | null;
    error?: string | null;
    checkpoint?: string | null;
  } = {}
): Promise<Job | null> {
  const rows = await sql`
    UPDATE jobs
    SET
      status = ${status},
      stop_reason = CASE
        WHEN ${options.stopReason ?? null} IS NOT NULL
        THEN ${options.stopReason ?? null}
        ELSE stop_reason
      END,
      error = CASE
        WHEN ${options.error ?? null} IS NOT NULL
        THEN ${options.error ?? null}
        ELSE error
      END,
      last_checkpoint = CASE
        WHEN ${options.checkpoint ?? null} IS NOT NULL
        THEN ${options.checkpoint ?? null}
        ELSE last_checkpoint
      END,
      started_at = CASE
        WHEN ${status} = 'running'
          AND started_at IS NULL
        THEN NOW()
        ELSE started_at
      END,
      finished_at = CASE
        WHEN ${status} IN (
          'completed',
          'failed',
          'stopped'
        )
        THEN NOW()
        WHEN ${status} NOT IN (
          'completed',
          'failed',
          'stopped'
        )
        THEN NULL
        ELSE finished_at
      END,
      updated_at = NOW()
    WHERE id = ${jobId}
    RETURNING
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
  `;
  const job =
    (rows[0] as Job | undefined) ??
    null;
  if (job) {
    await writeLog({
      jobId,
      event: "job_status_changed",
      message:
        `Job status changed to ${status}`,
      details: {
        status,
        checkpoint:
          options.checkpoint ?? null,
        stopReason:
          options.stopReason ?? null
      }
    });
  }
  return job;
}
/**
 * Updates job-level progress.
 *
 * completed_chunks is intentionally NOT modified here.
 * Chunk completion is handled atomically by completeChunk()
 * in queue.ts.
 */
export async function updateJobProgress(
  jobId: string,
  processedDelta: number,
  checkpoint?: string | null
): Promise<void> {
  if (
    !Number.isSafeInteger(
      processedDelta
    ) ||
    processedDelta < 0
  ) {
    throw new Error(
      "processedDelta must be a non-negative safe integer"
    );
  }
  await sql`
    UPDATE jobs
    SET
      processed =
        processed + ${processedDelta},
      last_checkpoint = CASE
        WHEN ${checkpoint ?? null} IS NOT NULL
        THEN ${checkpoint ?? null}
        ELSE last_checkpoint
      END,
      updated_at = NOW()
    WHERE id = ${jobId}
  `;
}
