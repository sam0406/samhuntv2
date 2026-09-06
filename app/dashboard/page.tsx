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
        throw new Error(data.error ?? "Failed to load jobs");
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
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse"
            }}
          >
            <thead>
              <tr>
                <th style={cellStyle}>Job</th>
                <th style={cellStyle}>Puzzle</th>
                <th style={cellStyle}>Status</th>
                <th style={cellStyle}>Progress</th>
                <th style={cellStyle}>Processed</th>
                <th style={cellStyle}>Checkpoint</th>
              </tr>
            </thead>

            <tbody>
              {jobs.map((job) => {
                const progress =
                  job.total_chunks > 0
                    ? Math.round(
                        (job.completed_chunks /
                          job.total_chunks) *
                          100
                      )
                    : 0;

                return (
                  <tr key={job.id}>
                    <td style={cellStyle}>
                      <code>
                        {job.id.slice(0, 8)}
                      </code>
                    </td>

                    <td style={cellStyle}>
                      {job.puzzle_id ?? "-"}
                    </td>

                    <td style={cellStyle}>
                      {job.status}
                    </td>

                    <td style={cellStyle}>
                      {job.completed_chunks}/
                      {job.total_chunks}
                      {" "}
                      ({progress}%)
                    </td>

                    <td style={cellStyle}>
                      {job.processed}
                    </td>

                    <td style={cellStyle}>
                      <code>
                        {job.last_checkpoint ?? "-"}
                      </code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section style={{ marginTop: 35 }}>
        <h2>Navigation</h2>

        <p>
          <a href="/">Create a benchmark job</a>
        </p>
      </section>
    </main>
  );
}

const cellStyle = {
  border: "1px solid #ccc",
  padding: "10px",
  textAlign: "left" as const
};
