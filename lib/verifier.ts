import { getJob, updateJobStatus } from "@/lib/jobs";
import { getPuzzleFixture } from "@/lib/puzzles";
import { writeLog } from "@/lib/logger";
export interface VerificationRequest {
  jobId: string;
  result: string;
}
export interface VerificationResult {
  verified: boolean;
  expected: string;
  received: string;
  message: string;
}
/**
 * Verifies a deterministic benchmark result against the trusted fixture.
 *
 * The expected value comes from the benchmark fixture and must never be
 * taken from worker-generated state such as a checkpoint.
 */
export async function verifyResult({
  jobId,
  result
}: VerificationRequest): Promise<VerificationResult> {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }
  if (job.puzzle_id === null) {
    throw new Error(
      `Job ${jobId} is not associated with a benchmark fixture`
    );
  }
  const fixture = getPuzzleFixture(job.puzzle_id);
  if (!fixture) {
    throw new Error(
      `Benchmark fixture ${job.puzzle_id} is not available`
    );
  }
  const expected = fixture.expectedBenchmark;
  const received = result.trim();
  if (!received) {
    await writeLog({
      jobId,
      level: "warn",
      event: "verification_failed",
      message: "Worker returned an empty result",
      details: {
        puzzleId: fixture.id
      }
    });
    return {
      verified: false,
      expected,
      received,
      message: "Empty result"
    };
  }
  const verified = received === expected;
  if (verified) {
    await updateJobStatus(jobId, "completed");
    await writeLog({
      jobId,
      event: "verification_passed",
      message: "Benchmark result verified",
      details: {
        puzzleId: fixture.id,
        expected,
        received
      }
    });
    return {
      verified: true,
      expected,
      received,
      message: "Benchmark result verified successfully"
    };
  }
  await writeLog({
    jobId,
    level: "warn",
    event: "verification_failed",
    message:
      "Benchmark result did not match the trusted fixture",
    details: {
      puzzleId: fixture.id,
      expected,
      received
    }
  });
  return {
    verified: false,
    expected,
    received,
    message:
      "Result does not match the trusted benchmark value"
  };
}
