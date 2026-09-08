CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS puzzles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  range_start TEXT NOT NULL,
  range_end TEXT NOT NULL,
  public_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  puzzle_id INTEGER REFERENCES puzzles(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'queued',

  range_start TEXT NOT NULL,
  range_end TEXT NOT NULL,

  chunk_size BIGINT NOT NULL,

  total_chunks BIGINT NOT NULL DEFAULT 0,
  completed_chunks BIGINT NOT NULL DEFAULT 0,

  processed BIGINT NOT NULL DEFAULT 0,

  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,

  last_checkpoint TEXT,
  stop_reason TEXT,
  error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT jobs_status_check
    CHECK (
      status IN (
        'queued',
        'running',
        'paused',
        'completed',
        'failed',
        'stopped'
      )
    ),

  CONSTRAINT jobs_range_check
    CHECK (range_start <> '' AND range_end <> ''),

  CONSTRAINT jobs_chunk_size_check
    CHECK (chunk_size > 0),

  CONSTRAINT jobs_total_chunks_check
    CHECK (total_chunks >= 0),

  CONSTRAINT jobs_completed_chunks_check
    CHECK (completed_chunks >= 0),

  CONSTRAINT jobs_processed_check
    CHECK (processed >= 0)
);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id UUID NOT NULL
    REFERENCES jobs(id)
    ON DELETE CASCADE,

  chunk_index BIGINT NOT NULL,

  range_start TEXT NOT NULL,
  range_end TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'queued',

  processed BIGINT NOT NULL DEFAULT 0,

  worker_id TEXT,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  last_checkpoint TEXT,

  throughput DOUBLE PRECISION,

  error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chunks_status_check
    CHECK (
      status IN (
        'queued',
        'running',
        'completed',
        'failed',
        'stopped'
      )
    ),

  CONSTRAINT chunks_processed_check
    CHECK (processed >= 0),

  CONSTRAINT chunks_unique_index
    UNIQUE (job_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS job_logs (
  id BIGSERIAL PRIMARY KEY,

  job_id UUID NOT NULL
    REFERENCES jobs(id)
    ON DELETE CASCADE,

  chunk_id UUID
    REFERENCES chunks(id)
    ON DELETE SET NULL,

  level TEXT NOT NULL DEFAULT 'info',

  event TEXT NOT NULL,

  message TEXT,

  details JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT job_logs_level_check
    CHECK (
      level IN (
        'info',
        'warn',
        'error'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at
  ON jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_status
  ON jobs(status);

CREATE INDEX IF NOT EXISTS idx_jobs_puzzle_id
  ON jobs(puzzle_id);

CREATE INDEX IF NOT EXISTS idx_chunks_job_id
  ON chunks(job_id);

CREATE INDEX IF NOT EXISTS idx_chunks_job_status
  ON chunks(job_id, status);

CREATE INDEX IF NOT EXISTS idx_chunks_worker_id
  ON chunks(worker_id);

CREATE INDEX IF NOT EXISTS idx_job_logs_job_id_created_at
  ON job_logs(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_logs_chunk_id
  ON job_logs(chunk_id);
