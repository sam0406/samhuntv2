import Link from "next/link";
import JobList from "@/components/JobList";

export default function DashboardPage() {
  return (
    <main>
      <header className="page-header">
        <div>
          <h1>SamHunt Dashboard</h1>
          <p className="section-description">
            Monitor deterministic benchmark jobs, workers,
            chunks, checkpoints, and execution logs.
          </p>
        </div>

        <Link
          href="/create-job"
          className="button-link"
        >
          Create Job
        </Link>
      </header>

      <JobList />
    </main>
  );
}
