"use client";

import { useState } from "react";

interface WorkerControlsProps {
  jobId: string;
}

export default function WorkerControls({
  jobId
}: WorkerControlsProps) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function startWorker() {
    setRunning(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/jobs/${jobId}/worker`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            operationsPerStep: 1000,
            maxSteps: 100
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Worker failed"
        );
      }

      setMessage(
        `Worker completed ${data.worker.chunksProcessed} chunk(s) and processed ${data.worker.operations} operations.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Worker failed"
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 25,
        padding: 20,
        border: "1px solid #ccc",
        borderRadius: 8
      }}
    >
      <h2>Worker</h2>

      <button
        onClick={startWorker}
        disabled={running}
        style={{
          padding: "12px 18px",
          cursor: running ? "wait" : "pointer"
        }}
      >
        {running
          ? "Worker running..."
          : "Run Worker"}
      </button>

      {message && (
        <p style={{ marginTop: 15 }}>
          {message}
        </p>
      )}
    </section>
  );
}
