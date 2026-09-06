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
  processed: number;
  started_at: string | null;
  finished_at: string | null;
  last_checkpoint: string | null;
  stop_reason: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
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
  logs: JobLog[];
}
interface JobStatusProps {
  jobId: string;
}
function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
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
export default function JobStatus({
  jobId
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
          cache: "no-store"
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
    const interval = window.setInterval(
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
              "application/json"
          },
          body: JSON.stringify({
            status,
            reason
          })
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
  const { job, logs } = data;
  const progress = getProgress(job);
  const canPause =
    job.status === "queued" ||
    job.status === "running";
  const canStop =
    job.status === "queued" ||
    job.status === "running" ||
    job.status === "paused";
  return (
    <main className="job-status">
      <div className="job-header">
        <div>
          <p className="eyebrow">
            Benchmark Job
          </p>
          <h1>
            {job.id}
          </h1>
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
              width: `${progress}%`
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
            )} chunks
          </span>
        </div>
        <div className="stats-grid">
          <div className="stat">
            <span>
              Processed
            </span>
            <strong>
              {formatNumber(
                job.processed
              )}
            </strong>
          </div>
          <div className="stat">
            <span>
              Chunk size
            </span>
            <strong>
              {formatNumber(
                job.chunk_size
              )}
            </strong>
          </div>
          <div className="stat">
            <span>
              Puzzle
            </span>
            <strong>
              {job.puzzle_id ?? "—"}
            </strong>
          </div>
        </div>
      </section>
      <section className="job-card">
        <h2>Range</h2>
        <div className="range-grid">
          <div>
            <span>Start</span>
            <code>
              {job.range_start}
            </code>
          </div>
          <div>
            <span>End</span>
            <code>
              {job.range_end}
            </code>
          </div>
        </div>
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
        {job.status === "paused" && (
          <p className="hint">
            The job is paused. Resume
            support will be connected to
            the worker controller next.
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
      <style jsx>{`
        .job-status {
          max-width: 1000px;
          margin: 0 auto;
          padding: 32px 20px 64px;
        }
        .job-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }
        .eyebrow {
          margin: 0 0 6px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.65;
        }
        h1 {
          margin: 0;
          font-size: 24px;
          word-break: break-all;
        }
        h2 {
          margin: 0 0 18px;
          font-size: 18px;
        }
        .status {
          padding: 7px 12px;
          border-radius: 999px;
          background: #eee;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-running {
          background: #dff6e4;
        }
        .status-completed {
          background: #dceeff;
        }
        .status-failed {
          background: #ffe0e0;
        }
        .status-paused {
          background: #fff0c9;
        }
        .status-stopped {
          background: #e5e5e5;
        }
        .job-card {
          margin-bottom: 18px;
          padding: 22px;
          border: 1px solid #ddd;
          border-radius: 12px;
          background: #fff;
        }
        .progress-container {
          width: 100%;
          height: 14px;
          overflow: hidden;
          border-radius: 999px;
          background: #e9e9e9;
        }
        .progress-bar {
          height: 100%;
          background: #111;
          transition: width 0.4s ease;
        }
        .progress-row {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          gap: 20px;
        }
        .stats-grid,
        .metadata,
        .range-grid {
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(180px, 1fr)
            );
          gap: 16px;
          margin-top: 22px;
        }
        .stat,
        .metadata > div,
        .range-grid > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .stat span,
        .metadata span,
        .range-grid span {
          font-size: 12px;
          opacity: 0.6;
        }
        code,
        pre {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
        }
        code {
          word-break: break-all;
        }
        .checkpoint {
          display: block;
          padding: 12px;
          border-radius: 8px;
          background: #f5f5f5;
        }
        .controls {
          display: flex;
          gap: 10px;
        }
        button {
          border: 0;
          border-radius: 8px;
          padding: 10px 18px;
          cursor: pointer;
          font-weight: 600;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .hint {
          margin-bottom: 0;
          font-size: 13px;
          opacity: 0.65;
        }
        .error-box {
          padding: 12px;
          border-radius: 8px;
          background: #ffe5e5;
          color: #8b0000;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }
        .section-header h2 {
          margin-bottom: 0;
        }
        .logs {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 18px;
        }
        .log-entry {
          padding: 14px;
          border-radius: 8px;
          background: #f7f7f7;
        }
        .log-top {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .log-top time {
          margin-left: auto;
          font-size: 12px;
          opacity: 0.55;
        }
        .log-level {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .log-error {
          color: #b00020;
        }
        .log-warn {
          color: #9a6500;
        }
        .log-debug {
          opacity: 0.6;
        }
        .log-entry p {
          margin: 8px 0 0;
        }
        .log-entry pre {
          margin: 10px 0 0;
          padding: 10px;
          overflow-x: auto;
          border-radius: 6px;
          background: #eaeaea;
          font-size: 12px;
        }
        @media (max-width: 600px) {
          .job-header {
            flex-direction: column;
          }
          .progress-row {
            flex-direction: column;
            gap: 5px;
          }
          .log-top time {
            width: 100%;
            margin-left: 0;
          }
        }
      `}</style>
    </main>
  );
}
