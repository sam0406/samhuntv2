export type JobStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "stopped";

export type ChunkStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export type LogLevel =
  | "info"
  | "warn"
  | "error";

export interface Job {
  id: string;
  puzzle_id: number | null;
  status: JobStatus;

  // PostgreSQL BIGINT / arbitrary-size range values
  range_start: string;
  range_end: string;

  // Chunk size is kept as a number because our API
  // validates it as a safe JavaScript integer.
  chunk_size: number;

  total_chunks: number;
  completed_chunks: number;

  // BIGINT from PostgreSQL
  processed: string;

  started_at: string | null;
  finished_at: string | null;

  // Arbitrary-size checkpoint
  last_checkpoint: string | null;

  stop_reason: string | null;
  error: string | null;

  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  job_id: string;
  chunk_index: number;

  // Arbitrary-size range values
  range_start: string;
  range_end: string;

  status: ChunkStatus;

  // PostgreSQL BIGINT
  processed: string;

  worker_id: string | null;

  started_at: string | null;
  completed_at: string | null;

  // Arbitrary-size checkpoint
  last_checkpoint: string | null;

  throughput: number | null;
  error: string | null;

  created_at: string;
}

export interface JobLog {
  id: number;
  job_id: string;
  chunk_id: string | null;

  level: LogLevel;
  event: string;
  message: string | null;

  details: Record<string, unknown>;

  created_at: string;
}
