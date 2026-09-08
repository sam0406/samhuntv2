import { getJob, updateJobStatus } from "@/lib/jobs";
import { getPuzzleFixture } from "@/lib/puzzles";
import { writeLog } from "@/lib/logger";

export interface VerificationResult {
  ok: boolean;
  jobId: string;
  status: string;
  message: string;
  details: Record<string, unknown>;
}

const EXPECTED_BENCHMARK = "PUZZLE69_BENCHMARK_OK";

export async function verifyJob(
  jobId: string,
): Promise<VerificationResult> {
  const job = await getJob(jobId);

  if (!job) {
    return {
      ok: false,
      jobId,
      status: "missing",
      message: "Job not found",
      details: {},
    };
  }

  const puzzleId =
    job.puzzle_id === null ||
    job.puzzle_id === undefined
      ? null
      : Number(job.puzzle_id);

  const puzzle =
    puzzleId === null
      ? null
      : getPuzzleFixture(puzzleId);

  if (!puzzle) {
    await writeLog({
      jobId,
      level: "error",
      event: "verification_failed",
      message: "No benchmark fixture is associated with this job",
      details: {
        puzzleId,
      },
    });

    return {
      ok: false,
      jobId,
      status: job.status,
      message: "No benchmark fixture is associated with this job",
      details: {
        puzzleId,
      },
    };
  }

  /*
   * Verification intentionally checks the benchmark fixture
   * and job accounting only. It does not derive, search for,
   * or recover any cryptocurrency private key.
   */

  const rangeStart = BigInt(job.range_start);
  const rangeEnd = BigInt(job.range_end);
  const processed = BigInt(job.processed);

  if (rangeEnd < rangeStart) {
    await updateJobStatus(jobId, "failed", {
      error: "Invalid job range",
    });

    return {
      ok: false,
      jobId,
      status: "failed",
      message: "Invalid job range",
      details: {},
    };
  }

  const expectedOperations =
    rangeEnd - rangeStart + 1n;

  if (processed > expectedOperations) {
    await updateJobStatus(jobId, "failed", {
      error: "Processed count exceeds job range",
    });

    await writeLog({
      jobId,
      level: "error",
      event: "verification_failed",
      message:
        "Processed count exceeds the number of benchmark operations",
      details: {
        processed: processed.toString(),
        expectedOperations:
          expectedOperations.toString(),
      },
    });

    return {
      ok: false,
      jobId,
      status: "failed",
      message:
        "Processed count exceeds the number of benchmark operations",
      details: {
        processed: processed.toString(),
        expectedOperations:
          expectedOperations.toString(),
      },
    };
  }

  const expectedCheckpoint =
    processed > 0n
      ? (rangeStart + processed - 1n).toString()
      : null;

  const checkpointMatches =
    job.last_checkpoint === expectedCheckpoint ||
    (processed === 0n &&
      (job.last_checkpoint === null ||
        job.last_checkpoint === ""));

  const completed =
    job.completed_chunks >= job.total_chunks;

  const benchmarkIdentity =
    puzzle.id === 69
      ? EXPECTED_BENCHMARK
      : `PUZZLE_${puzzle.id}_BENCHMARK`;

  const valid =
    checkpointMatches &&
    (!completed || processed === expectedOperations);

  const details = {
    puzzleId: puzzle.id,
    benchmark: benchmarkIdentity,
    processed: processed.toString(),
    expectedOperations:
      expectedOperations.toString(),
    expectedCheckpoint,
    actualCheckpoint:
      job.last_checkpoint,
    completedChunks:
      job.completed_chunks,
    totalChunks:
      job.total_chunks,
    completed,
    checkpointMatches,
  };

  if (!valid) {
    await writeLog({
      jobId,
      level: "error",
      event: "verification_failed",
      message: "Benchmark verification failed",
      details,
    });

    return {
      ok: false,
      jobId,
      status: job.status,
      message: "Benchmark verification failed",
      details,
    };
  }

  await writeLog({
    jobId,
    event: "verification_passed",
    message: "Benchmark verification passed",
    details,
  });

  return {
    ok: true,
    jobId,
    status: job.status,
    message: "Benchmark verification passed",
    details,
  };
}
