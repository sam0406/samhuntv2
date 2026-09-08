"use client";

import { useCallback, useEffect, useState } from "react";

interface Job {
  id: string;
  puzzle_id: number | null;
  status: string;
  range_start: string;
  range_end: string;
  chunk_size: number;
  total_chunks: number;
  completed_chunks: number;
  processed: string;
  started_at: string | null;
  finished_at: string | null;
  last_checkpoint: string | null;
  stop_reason: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface Chunk {
  id: string;
  job_id: string;
  chunk_index: number;
  range_start: string;
  range_end: string;
  status: string;
  processed: string;
  worker_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_checkpoint: string | null;
  throughput: number | null;
  error: string | null;
  created_at: string;
}

interface JobLog {
  id: number;
  job_id: string;
  chunk_id: string | null;
  level: string;
  event: string;
  message: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface JobResponse {
  job: Job;
  chunks: Chunk[];
  logs: JobLog[];
}

interface JobStatusProps {
  jobId: string;
}

function formatNumber(value: number | string): string {
  try {
    return new Intl.NumberFormat("en-US").format(
      BigInt(value)
    );
  } catch {
    return String(value);
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function formatRange(value: string): string {
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return value;
  }
}

function getProgress(job: Job): number {
  if (job.total_chunks <= 0) {
    return 0;
  }

  return Math.min(
    100,
    (job.completed_chunks / job.total_chunks) * 100
  );
}

function statusClass(status: string): string {
  switch (status) {
    case "running":
      return "status status-running";
    case "completed":
      return "status status-completed";
    case "failed":
      return "status status-failed";
    case "paused":
      return "status status-paused";
    case "stopped":
      return "status status-stopped";
    default:
      return "status";
  }
}

function chunkStatusClass(status: string): string {
  switch (status) {
    case "completed":
      return "chunk-status chunk-completed";
    case "running":
      return "chunk-status chunk-running";
    case "failed":
      return "chunk-status chunk-failed";
    case "stopped":
      return "chunk-status chunk-stopped";
    case "queued":
      return "chunk-status chunk-queued";
    default:
      return "chunk-status";
  }
}

export default function JobStatus({
  jobId,
}: JobStatusProps) {
  const [data, setData] =
    useState<JobResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [actionLoading, setActionLoading] =
    useState(false);

  const loadJob = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/jobs/${jobId}`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Failed to load job"
        );
      }

      setData(result);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadJob();

    const interval =
      window.setInterval(
        loadJob,
        5000
      );

    return () => {
      window.clearInterval(interval);
    };
  }, [loadJob]);

  async function changeStatus(
    status: "paused" | "stopped"
  ) {
    if (actionLoading) {
      return;
    }

    setActionLoading(true);

    try {
      const reason =
        status === "stopped"
          ? window.prompt(
              "Reason for stopping this job:",
              "Stopped by user"
            ) ?? "Stopped by user"
          : undefined;

      const response = await fetch(
        `/api/jobs/${jobId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status,
            reason,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Failed to update job"
        );
      }

      await loadJob();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="job-status">
        <p>Loading job…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="job-status">
        <h1>Job</h1>

        <div className="error-box">
          {error}
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="job-status">
        <p>Job not found.</p>
      </main>
    );
  }

  const {
    job,
    chunks = [],
    logs,
  } = data;

  const progress =
    getProgress(job);

  const canPause =
    job.status === "queued" ||
    job.status === "running";

  const canStop =
    job.status === "queued" ||
    job.status === "running" ||
    job.status === "paused";

  const completedChunks =
    chunks.filter(
      (chunk) =>
        chunk.status === "completed"
    );

  return (
    <main className="job-status">
      <div className="job-header">
        <div>
          <p className="eyebrow">
            Benchmark Job
          </p>

          <h1>{job.id}</h1>
        </div>

        <span
          className={statusClass(
            job.status
          )}
        >
          {job.status}
        </span>
      </div>

      <section className="job-card">
        <h2>Progress</h2>

        <div className="progress-container">
          <div
            className="progress-bar"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="progress-row">
          <strong>
            {progress.toFixed(2)}%
          </strong>

          <span>
            {formatNumber(
              job.completed_chunks
            )}{" "}
            /{" "}
            {formatNumber(
              job.total_chunks
            )}{" "}
            chunks
          </span>
        </div>

        <div className="stats-grid">
          <div className="stat">
            <span>Processed</span>

            <strong>
              {formatNumber(
                job.processed
              )}
            </strong>
          </div>

          <div className="stat">
            <span>Chunk size</span>

            <strong>
              {formatNumber(
                job.chunk_size
              )}
            </strong>
          </div>

          <div className="stat">
            <span>Puzzle</span>

            <strong>
              {job.puzzle_id ?? "—"}
            </strong>
          </div>

          <div className="stat">
            <span>
              Completed chunks
            </span>

            <strong>
              {formatNumber(
                completedChunks.length
              )}
            </strong>
          </div>
        </div>
      </section>

      <section className="job-card">
        <h2>Job Range</h2>

        <div className="range-grid">
          <div>
            <span>Start</span>

            <code>
              {formatRange(
                job.range_start
              )}
            </code>
          </div>

          <div>
            <span>End</span>

            <code>
              {formatRange(
                job.range_end
              )}
            </code>
          </div>
        </div>
      </section>

      <section className="job-card">
        <div className="section-header">
          <div>
            <h2>
              Processed Chunks
            </h2>

            <p className="section-description">
              Exact ranges tested by
              each chunk.
            </p>
          </div>

          <span>
            {completedChunks.length} /{" "}
            {chunks.length} completed
          </span>
        </div>

        {chunks.length === 0 ? (
          <p>
            No chunks have been
            created yet.
          </p>
        ) : (
          <div className="chunk-list">
            {chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="chunk-card"
              >
                <div className="chunk-header">
                  <div>
                    <strong>
                      Chunk #
                      {chunk.chunk_index}
                    </strong>

                    <span
                      className={chunkStatusClass(
                        chunk.status
                      )}
                    >
                      {chunk.status}
                    </span>
                  </div>

                  <span className="chunk-processed">
                    {formatNumber(
                      chunk.processed
                    )}{" "}
                    processed
                  </span>
                </div>

                <div className="tested-range">
                  <span>
                    Tested range
                  </span>

                  <code>
                    {formatRange(
                      chunk.range_start
                    )}
                  </code>

                  <span className="range-arrow">
                    →
                  </span>

                  <code>
                    {formatRange(
                      chunk.range_end
                    )}
                  </code>
                </div>

                <div className="chunk-details">
                  <div>
                    <span>
                      Checkpoint
                    </span>

                    <code>
                      {chunk.last_checkpoint
                        ? formatRange(
                            chunk.last_checkpoint
                          )
                        : "—"}
                    </code>
                  </div>

                  <div>
                    <span>Worker</span>

                    <code>
                      {chunk.worker_id ??
                        "—"}
                    </code>
                  </div>

                  <div>
                    <span>
                      Throughput
                    </span>

                    <strong>
                      {chunk.throughput !==
                      null
                        ? `${formatNumber(
                            chunk.throughput
                          )} ops/s`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Started</span>

                    <strong>
                      {formatDate(
                        chunk.started_at
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Completed
                    </span>

                    <strong>
                      {formatDate(
                        chunk.completed_at
                      )}
                    </strong>
                  </div>
                </div>

                {chunk.error && (
                  <div className="error-box">
                    {chunk.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="job-card">
        <h2>Checkpoint</h2>

        <code className="checkpoint">
          {job.last_checkpoint ??
            "No checkpoint yet"}
        </code>

        <div className="metadata">
          <div>
            <span>Created</span>

            <strong>
              {formatDate(
                job.created_at
              )}
            </strong>
          </div>

          <div>
            <span>Started</span>

            <strong>
              {formatDate(
                job.started_at
              )}
            </strong>
          </div>

          <div>
            <span>Updated</span>

            <strong>
              {formatDate(
                job.updated_at
              )}
            </strong>
          </div>

          <div>
            <span>Finished</span>

            <strong>
              {formatDate(
                job.finished_at
              )}
            </strong>
          </div>
        </div>
      </section>

      {(job.stop_reason ||
        job.error) && (
        <section className="job-card">
          <h2>Result</h2>

          {job.stop_reason && (
            <p>
              <strong>
                Stop reason:
              </strong>{" "}
              {job.stop_reason}
            </p>
          )}

          {job.error && (
            <div className="error-box">
              {job.error}
            </div>
          )}
        </section>
      )}

      <section className="job-card">
        <h2>Controls</h2>

        <div className="controls">
          <button
            type="button"
            disabled={
              actionLoading ||
              !canPause
            }
            onClick={() =>
              changeStatus("paused")
            }
          >
            {actionLoading
              ? "Working…"
              : "Pause"}
          </button>

          <button
            type="button"
            disabled={
              actionLoading ||
              !canStop
            }
            onClick={() =>
              changeStatus("stopped")
            }
          >
            Stop
          </button>
        </div>

        {job.status ===
          "paused" && (
          <p className="hint">
            The job is paused.
          </p>
        )}
      </section>

      <section className="job-card">
        <div className="section-header">
          <h2>Recent Logs</h2>

          <span>
            {logs.length} events
          </span>
        </div>

        {logs.length === 0 ? (
          <p>No logs yet.</p>
        ) : (
          <div className="logs">
            {logs.map((log) => (
              <div
                key={log.id}
                className="log-entry"
              >
                <div className="log-top">
                  <strong>
                    {log.event}
                  </strong>

                  <span
                    className={`log-level log-${log.level}`}
                  >
                    {log.level}
                  </span>

                  <time>
                    {formatDate(
                      log.created_at
                    )}
                  </time>
                </div>

                {log.message && (
                  <p>
                    {log.message}
                  </p>
                )}

                {Object.keys(
                  log.details ?? {}
                ).length > 0 && (
                  <pre>
                    {JSON.stringify(
                      log.details,
                      null,
                      2
                    )}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
