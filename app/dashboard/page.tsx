"use client";

import { useEffect, useState } from "react";
import JobList from "@/components/JobList";

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
  last_checkpoint: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadJobs() {
    try {
      const response = await fetch("/api/jobs", {
        cache: "no-store"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Failed to load jobs"
        );
      }

      setJobs(data.jobs ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load jobs"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();

    const interval = setInterval(loadJobs, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <h1>SamHunt v2 Dashboard</h1>

      <p>
        Job and worker monitoring
      </p>

      <hr />

      {loading && <p>Loading jobs...</p>}

      {error && (
        <p>
          <strong>Error:</strong> {error}
        </p>
      )}

      {!loading && !error && jobs.length === 0 && (
        <p>No jobs created yet.</p>
      )}

      {jobs.length > 0 && (
        <JobList jobs={jobs} />
      )}

      <section style={{ marginTop: 35 }}>
        <h2>Navigation</h2>

        <p>
          <a href="/">
            Create a benchmark job
          </a>
        </p>
      </section>
    </main>
  );
}
