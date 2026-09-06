"use client";

interface Job {
  id: string;
  puzzle_id: number | null;
  status: string;
  total_chunks: number;
  completed_chunks: number;
  processed: number;
  last_checkpoint: string | null;
  updated_at: string;
}

interface JobListProps {
  jobs: Job[];
}

export default function JobList({
  jobs
}: JobListProps) {
  if (jobs.length === 0) {
    return <p>No jobs created yet.</p>;
  }

  return (
    <div
      style={{
        overflowX: "auto",
        marginTop: 25
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse"
        }}
      >
        <thead>
          <tr>
            <th style={cellStyle}>Job</th>
            <th style={cellStyle}>Puzzle</th>
            <th style={cellStyle}>Status</th>
            <th style={cellStyle}>Progress</th>
            <th style={cellStyle}>Processed</th>
            <th style={cellStyle}>Checkpoint</th>
            <th style={cellStyle}>Updated</th>
            <th style={cellStyle}>Action</th>
          </tr>
        </thead>

        <tbody>
          {jobs.map((job) => {
            const progress =
              job.total_chunks > 0
                ? Math.round(
                    (job.completed_chunks /
                      job.total_chunks) *
                      100
                  )
                : 0;

            return (
              <tr key={job.id}>
                <td style={cellStyle}>
                  <code>
                    {job.id.slice(0, 8)}
                  </code>
                </td>

                <td style={cellStyle}>
                  {job.puzzle_id ?? "-"}
                </td>

                <td style={cellStyle}>
                  {job.status}
                </td>

                <td style={cellStyle}>
                  {job.completed_chunks}/
                  {job.total_chunks}
                  {" "}
                  ({progress}%)
                </td>

                <td style={cellStyle}>
                  {job.processed}
                </td>

                <td style={cellStyle}>
                  <code>
                    {job.last_checkpoint ?? "-"}
                  </code>
                </td>

                <td style={cellStyle}>
                  {new Date(
                    job.updated_at
                  ).toLocaleString()}
                </td>

                <td style={cellStyle}>
                  <a href={`/dashboard/${job.id}`}>
                    View
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle = {
  border: "1px solid #ccc",
  padding: "10px",
  textAlign: "left" as const
};
