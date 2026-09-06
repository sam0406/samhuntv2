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

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Puzzle {
  id: number;
  name: string;
  address: string | null;
  range_start: string;
  range_end: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Job {
  id: string;
  puzzle_id: number | null;
  status: JobStatus;
  range_start: string;
  range_end: string;
  chunk_size: number;
  total_chunks: number;
  completed_chunks: number;
  processed: number;
  started_at: string | null;
  finished_at: string | null;
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
  range_start: string;
  range_end: string;
  status: ChunkStatus;
  processed: number;
  worker_id: string | null;
  started_at: string | null;
  completed_at: string | null;
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
