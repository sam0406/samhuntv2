import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">BENCHMARK COMPUTATION</p>

          <h1>SamHunt</h1>

          <p className="hero-description">
            Distributed benchmark execution with durable
            checkpoints, chunk tracking, worker status, and
            persistent logs.
          </p>

          <div className="hero-actions">
            <Link
              href="/dashboard"
              className="button-link"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        <article className="feature-card">
          <h2>Chunked Jobs</h2>
          <p>
            Large benchmark ranges are divided into
            independently tracked chunks.
          </p>
        </article>

        <article className="feature-card">
          <h2>Persistent Checkpoints</h2>
          <p>
            Progress and checkpoints are stored in Neon so
            interrupted workers can resume safely.
          </p>
        </article>

        <article className="feature-card">
          <h2>Worker Tracking</h2>
          <p>
            See worker activity, throughput, completed
            chunks, and execution state.
          </p>
        </article>

        <article className="feature-card">
          <h2>Execution Logs</h2>
          <p>
            Every important job and chunk event is recorded
            for debugging and auditing.
          </p>
        </article>
      </section>
    </main>
  );
}
