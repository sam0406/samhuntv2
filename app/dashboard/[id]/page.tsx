import JobStatus from "@/components/JobStatus";
interface JobPageProps {
  params: Promise<{
    id: string;
  }>;
}
export default async function JobPage({
  params
}: JobPageProps) {
  const { id } = await params;
  return (
    <JobStatus jobId={id} />
  );
}
