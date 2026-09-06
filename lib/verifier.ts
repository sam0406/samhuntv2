import { getJob, updateJobStatus } from "@/lib/jobs";
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
 * Verifies a deterministic benchmark result.
 *
 * The expected value should come from a trusted test fixture,
 * not from worker-generated data.
 */
export async function verifyResult({
  jobId,
  result
}: VerificationRequest): Promise<VerificationResult> {
  const job = await getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const expected = job.last_checkpoint ?? "";

  const received = result.trim();

  if (!received) {
    await writeLog({
      jobId,
      level: "warn",
      event: "verification_failed",
      message: "Worker returned an empty result"
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
    message: "Benchmark result did not match expected value",
    details: {
      expected,
      received
    }
  });

  return {
    verified: false,
    expected,
    received,
    message: "Result does not match expected value"
  };
}
