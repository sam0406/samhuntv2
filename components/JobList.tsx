"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

function formatNumber(value: string | number): string {
  try {
    return new Intl.NumberFormat("en-US").format(BigInt(value));
  } catch {
    return String(value);
  }
}

export default function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadJobs() {
    try {
      const response = await fetch("/api/jobs", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Failed to load jobs",
        );
      }

      setJobs(data.jobs ?? []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();

    const interval = window.setInterval(loadJobs, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <section className="job-card">
        <h2>Jobs</h2>
        <p>Loading jobs…</p>
      </section>
    );
  }

  return (
    <section className="job-card">
      <div className="section-header">
        <div>
          <h2>Jobs</h2>
          <p className="section-description">
            Benchmark jobs and their current execution state.
          </p>
        </div>

        <button
          type="button"
          onClick={loadJobs}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {jobs.length === 0 ? (
        <p>No jobs have been created yet.</p>
      ) : (
        <div className="job-list">
          {jobs.map((job) => {
            const progress =
              job.total_chunks > 0
                ? Math.round(
                    (job.completed_chunks /
                      job.total_chunks) *
                      100,
                  )
                : 0;

            return (
              <Link
                key={job.id}
                href={`/dashboard/${job.id}`}
                className="job-list-item"
              >
                <div className="job-list-main">
                  <strong>
                    Puzzle {job.puzzle_id ?? "Benchmark"}
                  </strong>

                  <span className="job-id">
                    {job.id}
                  </span>
                </div>

                <div className="job-list-status">
                  <span className={`status status-${job.status}`}>
                    {job.status}
                  </span>
                </div>

                <div className="job-list-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <span>
                    {job.completed_chunks} /{" "}
                    {job.total_chunks} chunks
                  </span>
                </div>

                <div className="job-list-details">
                  <span>
                    Processed:{" "}
                    {formatNumber(job.processed)}
                  </span>

                  <span>
                    Range:{" "}
                    {job.range_start} → {job.range_end}
                  </span>

                  {job.last_checkpoint && (
                    <span>
                      Checkpoint:{" "}
                      {job.last_checkpoint}
                    </span>
                  )}
                </div>

                {job.error && (
                  <div className="job-list-error">
                    {job.error}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
