"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const PUZZLE_ID = 69;
const DEFAULT_START = "0x100000000000000000";
const DEFAULT_END = "0x1000000000000000ff";

export default function CreateJobPage() {
  const router = useRouter();

  const [rangeStart, setRangeStart] =
    useState(DEFAULT_START);
  const [rangeEnd, setRangeEnd] =
    useState(DEFAULT_END);
  const [chunkSize, setChunkSize] =
    useState("16");

  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          puzzleId: PUZZLE_ID,
          rangeStart: rangeStart.trim(),
          rangeEnd: rangeEnd.trim(),
          chunkSize: Number(chunkSize),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Failed to create job",
        );
      }

      router.push(
        `/dashboard/${data.job.id}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err),
      );

      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            BENCHMARK JOB
          </p>

          <h1>Create Job</h1>

          <p className="section-description">
            Create a deterministic benchmark job
            using the public Puzzle 69 fixture.
          </p>
        </div>
      </header>

      <section className="job-card">
        <form
          onSubmit={handleSubmit}
          className="job-form"
        >
          <div className="form-field">
            <label htmlFor="puzzle">
              Puzzle
            </label>

            <input
              id="puzzle"
              value="Puzzle 69"
              disabled
            />
          </div>

          <div className="form-field">
            <label htmlFor="rangeStart">
              Range start
            </label>

            <input
              id="rangeStart"
              value={rangeStart}
              onChange={(event) =>
                setRangeStart(
                  event.target.value,
                )
              }
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="rangeEnd">
              Range end
            </label>

            <input
              id="rangeEnd"
              value={rangeEnd}
              onChange={(event) =>
                setRangeEnd(
                  event.target.value,
                )
              }
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="chunkSize">
              Chunk size
            </label>

            <input
              id="chunkSize"
              type="number"
              min="1"
              step="1"
              value={chunkSize}
              onChange={(event) =>
                setChunkSize(
                  event.target.value,
                )
              }
              required
            />
          </div>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          <div className="hero-actions">
            <button
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Creating…"
                : "Create Benchmark Job"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/dashboard")
              }
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
