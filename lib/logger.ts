import { sql } from "@/lib/db";
import type { LogLevel } from "@/lib/types";

interface LogDetails {
  [key: string]: unknown;
}

interface WriteLogParams {
  jobId: string;
  chunkId?: string | null;
  level?: LogLevel;
  event: string;
  message?: string | null;
  details?: LogDetails;
}

export async function writeLog({
  jobId,
  chunkId = null,
  level = "info",
  event,
  message = null,
  details = {}
}: WriteLogParams): Promise<void> {
  await sql`
    INSERT INTO job_logs (
      job_id,
      chunk_id,
      level,
      event,
      message,
      details
    )
    VALUES (
      ${jobId},
      ${chunkId},
      ${level},
      ${event},
      ${message},
      ${JSON.stringify(details)}::jsonb
    )
  `;
}

export async function getJobLogs(
  jobId: string,
  limit = 200
) {
  return sql`
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
    WHERE job_id = ${jobId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}
