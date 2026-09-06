"use client";

import { FormEvent, useState } from "react";

interface CreatedJob {
  id: string;
  status: string;
  total_chunks: number;
}

export default function HomePage() {
  const [rangeStart, setRangeStart] = useState(
    "0x100000000000000000"
  );

  const [rangeEnd, setRangeEnd] = useState(
    "0x1000000000000000ff"
  );

  const [chunkSize, setChunkSize] = useState("16");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [job, setJob] = useState<CreatedJob | null>(null);

  async function createBenchmarkJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setJob(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          puzzleId: 69,
          rangeStart,
          rangeEnd,
          chunkSize: Number(chunkSize)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create job");
      }

      setJob(data.job);
      setMessage("Benchmark job created successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <h1>SamHunt v2</h1>

      <p>
        Distributed computation benchmark dashboard
      </p>

      <hr />

      <section style={{ marginTop: 30 }}>
        <h2>Create Benchmark Job</h2>

        <form
          onSubmit={createBenchmarkJob}
          style={{
            display: "grid",
            gap: 16,
            maxWidth: 650
          }}
        >
          <label>
            Puzzle
            <select
              disabled
              value="69"
              style={{
                display: "block",
                width: "100%",
                padding: 10,
                marginTop: 6
              }}
            >
              <option value="69">
                Puzzle 69 — Benchmark Fixture
              </option>
            </select>
          </label>

          <label>
            Range start
            <input
              value={rangeStart}
              onChange={(event) =>
                setRangeStart(event.target.value)
              }
              style={{
                display: "block",
                width: "100%",
                padding: 10,
                marginTop: 6,
                fontFamily: "monospace"
              }}
            />
          </label>

          <label>
            Range end
            <input
              value={rangeEnd}
              onChange={(event) =>
                setRangeEnd(event.target.value)
              }
              style={{
                display: "block",
                width: "100%",
                padding: 10,
                marginTop: 6,
                fontFamily: "monospace"
              }}
            />
          </label>

          <label>
            Chunk size
            <input
              type="number"
              min="1"
              value={chunkSize}
              onChange={(event) =>
                setChunkSize(event.target.value)
              }
              style={{
                display: "block",
                width: "100%",
                padding: 10,
                marginTop: 6
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 18px",
              cursor: loading ? "wait" : "pointer"
            }}
          >
            {loading
              ? "Creating..."
              : "Create Benchmark Job"}
          </button>
        </form>
      </section>

      {message && (
        <section style={{ marginTop: 25 }}>
          <strong>{message}</strong>
        </section>
      )}

      {job && (
        <section style={{ marginTop: 30 }}>
          <h2>Job Created</h2>

          <div
            style={{
              padding: 20,
              border: "1px solid #ccc",
              borderRadius: 8
            }}
          >
            <p>
              <strong>Job ID:</strong>{" "}
              <code>{job.id}</code>
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {job.status}
            </p>

            <p>
              <strong>Total chunks:</strong>{" "}
              {job.total_chunks}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
