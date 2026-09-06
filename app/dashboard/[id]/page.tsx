"use client";
import WorkerControls from "@/components/WorkerControls";
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
  processed: number;
  last_checkpoint: string | null;
  stop_reason: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface Chunk {
  id: string;
  chunk_index: number;
  range_start: string;
  range_end: string;
  status: string;
  processed: number;
  worker_id: string | null;
  last_checkpoint: string | null;
  throughput: number | null;
  error: string | null;
}

interface JobLog {
  id: number;
  level: string;
  event: string;
  message: string | null;
  created_at: string;
}

export default function JobDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [error, setError] = useState("");

  async function loadData(id: string) {
    try {
      const [jobResponse, chunksResponse, logsResponse] =
        await Promise.all([
          fetch(`/api/jobs/${id}`, {
            cache: "no-store"
          }),
          fetch(`/api/jobs/${id}/chunks`, {
            cache: "no-store"
          }),
          fetch(`/api/jobs/${id}/logs?limit=100`, {
            cache: "no-store"
          })
        ]);

      const jobData = await jobResponse.json();
      const chunksData = await chunksResponse.json();
      const logsData = await logsResponse.json();

      if (!jobResponse.ok) {
        throw new Error(
          jobData.error ?? "Failed to load job"
        );
      }

      setJob(jobData.job);
      setChunks(chunksData.chunks ?? []);
      setLogs(logsData.logs ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load job"
      );
    }
  }

  async function pauseJob() {
    await updateStatus("paused");
  }

  async function resumeJob() {
    await updateStatus("running");
  }

  async function stopJob() {
    await updateStatus(
      "stopped",
      "Stopped from dashboard"
    );
  }

  async function updateStatus(
    status: string,
    reason?: string
  ) {
    if (!jobId) return;

    try {
      const response = await fetch(
        `/api/jobs/${jobId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            status,
            reason
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Failed to update job"
        );
      }

      await loadData(jobId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update job"
      );
    }
  }

  useEffect(() => {
    params.then(({ id }) => {
      setJobId(id);
      loadData(id);
    });
  }, [params]);

  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(
      () => loadData(jobId),
      5000
    );

    return () => clearInterval(interval);
  }, [jobId]);

  if (error) {
    return (
      <main style={mainStyle}>
        <h1>Job Details</h1>
        <p>
          <strong>Error:</strong> {error}
        </p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  if (!job) {
    return (
      <main style={mainStyle}>
        <p>Loading job...</p>
      </main>
    );
  }

  const progress =
    job.total_chunks > 0
      ? Math.round(
          (job.completed_chunks /
            job.total_chunks) *
            100
        )
      : 0;

  return (
    <main style={mainStyle}>
      <p>
        <a href="/dashboard">
          ← Back to dashboard
        </a>
      </p>

      <h1>Job Details</h1>

      <section style={cardStyle}>
        <h2>Overview</h2>

        <p>
          <strong>Job ID:</strong>{" "}
          <code>{job.id}</code>
        </p>

        <p>
          <strong>Puzzle:</strong>{" "}
          {job.puzzle_id ?? "-"}
        </p>

        <p>
          <strong>Status:</strong>{" "}
          {job.status}
        </p>

        <p>
          <strong>Progress:</strong>{" "}
          {job.completed_chunks}/
          {job.total_chunks} ({progress}%)
        </p>

        <div
          style={{
            width: "100%",
            height: 12,
            background: "#ddd",
            borderRadius: 6,
            overflow: "hidden"
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "#222"
            }}
          />
        </div>

        <p>
          <strong>Processed:</strong>{" "}
          {job.processed}
        </p>

        <p>
          <strong>Checkpoint:</strong>{" "}
          <code>
            {job.last_checkpoint ?? "-"}
          </code>
        </p>

        <p>
          <strong>Range:</strong>{" "}
          <code>
            {job.range_start}
          </code>
          {" → "}
          <code>
            {job.range_end}
          </code>
        </p>

        {job.error && (
          <p>
            <strong>Error:</strong>{" "}
            {job.error}
          </p>
        )}

        {job.stop_reason && (
          <p>
            <strong>Stop reason:</strong>{" "}
            {job.stop_reason}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 20
          }}
        >
          <button onClick={resumeJob}>
            Resume
          </button>

          <button onClick={pauseJob}>
            Pause
          </button>

          <button onClick={stopJob}>
            Stop
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2>Chunks</h2>

        {chunks.length === 0 ? (
          <p>No chunks found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={cellStyle}>#</th>
                  <th style={cellStyle}>Status</th>
                  <th style={cellStyle}>Range</th>
                  <th style={cellStyle}>Processed</th>
                  <th style={cellStyle}>Worker</th>
                  <th style={cellStyle}>Checkpoint</th>
                  <th style={cellStyle}>
                    Throughput
                  </th>
                </tr>
              </thead>

              <tbody>
                {chunks.map((chunk) => (
                  <tr key={chunk.id}>
                    <td style={cellStyle}>
                      {chunk.chunk_index}
                    </td>

                    <td style={cellStyle}>
                      {chunk.status}
                    </td>

                    <td style={cellStyle}>
                      <code>
                        {chunk.range_start}
                        {" → "}
                        {chunk.range_end}
                      </code>
                    </td>

                    <td style={cellStyle}>
                      {chunk.processed}
                    </td>

                    <td style={cellStyle}>
                      <code>
                        {chunk.worker_id ?? "-"}
                      </code>
                    </td>

                    <td style={cellStyle}>
                      <code>
                        {chunk.last_checkpoint ?? "-"}
                      </code>
                    </td>

                    <td style={cellStyle}>
                      {chunk.throughput
                        ? `${chunk.throughput.toFixed(
                            2
                          )}/s`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2>Recent Logs</h2>

        {logs.length === 0 ? (
          <p>No logs yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={cellStyle}>Time</th>
                  <th style={cellStyle}>Level</th>
                  <th style={cellStyle}>Event</th>
                  <th style={cellStyle}>Message</th>
                </tr>
              </thead>

              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={cellStyle}>
                      {new Date(
                        log.created_at
                      ).toLocaleString()}
                    </td>

                    <td style={cellStyle}>
                      {log.level}
                    </td>

                    <td style={cellStyle}>
                      <code>
                        {log.event}
                      </code>
                    </td>

                    <td style={cellStyle}>
                      {log.message ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const mainStyle = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "40px 20px",
  fontFamily: "Arial, sans-serif"
};

const cardStyle = {
  marginTop: 25,
  padding: 20,
  border: "1px solid #ccc",
  borderRadius: 8
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const
};

const cellStyle = {
  border: "1px solid #ccc",
  padding: 10,
  textAlign: "left" as const
};
