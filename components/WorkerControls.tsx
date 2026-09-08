"use client";

import { useState } from "react";

interface WorkerResult {
  workerId?: string;
  processed?: number;
  completedChunks?: number;
  totalChunks?: number;
  status?: string;
  message?: string;
}

interface WorkerControlsProps {
  jobId: string;
}

export default function WorkerControls({
  jobId,
}: WorkerControlsProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] =
    useState<WorkerResult | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  async function startWorker() {
    if (running) return;

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/jobs/${jobId}/worker`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Worker failed to start"
        );
      }

      setResult(
        data.result ?? data.worker ?? data
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="job-card">
      <h2>Worker</h2>

      <p className="section-description">
        Run a benchmark worker for this job.
      </p>

      <button
        type="button"
        onClick={startWorker}
        disabled={running}
      >
        {running
          ? "Worker running…"
          : "Start Worker"}
      </button>

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {result && (
        <div className="worker-result">
          <h3>Worker Result</h3>

          {result.workerId && (
            <p>
              <strong>Worker:</strong>{" "}
              {result.workerId}
            </p>
          )}

          {result.status && (
            <p>
              <strong>Status:</strong>{" "}
              {result.status}
            </p>
          )}

          {typeof result.processed ===
            "number" && (
            <p>
              <strong>Processed:</strong>{" "}
              {result.processed.toLocaleString()}
            </p>
          )}

          {typeof result.completedChunks ===
            "number" &&
            typeof result.totalChunks ===
              "number" && (
              <p>
                <strong>Chunks:</strong>{" "}
                {result.completedChunks} /{" "}
                {result.totalChunks}
              </p>
            )}

          {result.message && (
            <p>{result.message}</p>
          )}
        </div>
      )}
    </section>
  );
}
