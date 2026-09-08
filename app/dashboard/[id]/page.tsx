import JobStatus from "@/components/JobStatus";
import WorkerControls from "@/components/WorkerControls";

interface JobPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function JobPage({
  params,
}: JobPageProps) {
  const { id } = await params;

  return (
    <main>
      <JobStatus jobId={id} />
      <WorkerControls jobId={id} />
    </main>
  );
}
