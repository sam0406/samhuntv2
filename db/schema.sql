CREATE TABLE IF NOT EXISTS puzzles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    range_start TEXT NOT NULL,
    range_end TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY,
    puzzle_id INTEGER REFERENCES puzzles(id),
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
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

    UNIQUE(job_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS job_logs (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
    level TEXT NOT NULL DEFAULT 'info',
    event TEXT NOT NULL,
    message TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status
    ON jobs(status);

CREATE INDEX IF NOT EXISTS idx_chunks_job_status
    ON chunks(job_id, status);

CREATE INDEX IF NOT EXISTS idx_job_logs_job_created
    ON job_logs(job_id, created_at);
