import JobStatus from "@/components/JobStatus";
import WorkerControls from "@/components/WorkerControls";
type PageProps = {
  params: Promise<{ id: string }>;
};
export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <a
          href="/dashboard"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to dashboard
        </a>
        <h1 className="mt-3 text-2xl font-bold">
          Job {id}
        </h1>
      </div>
      <div className="space-y-6">
        <WorkerControls jobId={id} />
        <JobStatus jobId={id} />
      </div>
    </main>
  );
}
