import { claimNextChunk, completeChunk } from "@/lib/queue";
import {
  getJob,
  updateJobProgress,
  updateJobStatus
} from "@/lib/jobs";
import { writeLog } from "@/lib/logger";

interface WorkerOptions {
  jobId: string;
  workerId?: string;
  operationsPerStep?: number;
  maxSteps?: number;
}

interface WorkerResult {
  workerId: string;
  chunksProcessed: number;
  operations: number;
}

function benchmarkOperation(value: bigint): bigint {
  let result = value;

  for (let i = 0; i < 32; i++) {
    result ^= result << 7n;
    result ^= result >> 9n;
    result &= (1n << 256n) - 1n;
  }

  return result;
}

export async function runWorker({
  jobId,
  workerId = crypto.randomUUID(),
  operationsPerStep = 1000,
  maxSteps = 100
}: WorkerOptions): Promise<WorkerResult> {
  if (operationsPerStep <= 0) {
    throw new Error("operationsPerStep must be greater than zero");
  }

  if (maxSteps <= 0) {
    throw new Error("maxSteps must be greater than zero");
  }

  const job = await getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (
    job.status === "paused" ||
    job.status === "stopped" ||
    job.status === "completed" ||
    job.status === "failed"
  ) {
    throw new Error(
      `Job cannot run while status is "${job.status}"`
    );
  }

  await updateJobStatus(jobId, "running");

  await writeLog({
    jobId,
    event: "worker_started",
    message: "Worker started",
    details: {
      workerId,
      operationsPerStep,
      maxSteps
    }
  });

  const workerStart = Date.now();

  let chunksProcessed = 0;
  let totalOperations = 0;
  let steps = 0;

  try {
    while (steps < maxSteps) {
      const currentJob = await getJob(jobId);

      if (!currentJob) {
        throw new Error(`Job ${jobId} no longer exists`);
      }

      if (
        currentJob.status === "paused" ||
        currentJob.status === "stopped"
      ) {
        break;
      }

      const chunk = await claimNextChunk(
        jobId,
        workerId
      );

      if (!chunk) {
        break;
      }

      const chunkStart = BigInt(chunk.range_start);
      const chunkEnd = BigInt(chunk.range_end);

      let current = chunkStart;
      let processed = 0;

      const chunkStarted = Date.now();

      while (current <= chunkEnd) {
        const remaining = chunkEnd - current + 1n;

        const stepSize =
          remaining < BigInt(operationsPerStep)
            ? Number(remaining)
            : operationsPerStep;

        for (let i = 0; i < stepSize; i++) {
          benchmarkOperation(
            current + BigInt(i)
          );
        }

        current += BigInt(stepSize);
        processed += stepSize;
        totalOperations += stepSize;
        steps++;

        const checkpoint =
          current > chunkEnd
            ? chunkEnd.toString()
            : (current - 1n).toString();

        await updateJobProgress(
          jobId,
          totalOperations,
          chunksProcessed,
          checkpoint
        );

        if (steps >= maxSteps) {
          break;
        }
      }

      if (current > chunkEnd) {
        const elapsedSeconds =
          (Date.now() - chunkStarted) / 1000;

        const throughput =
          elapsedSeconds > 0
            ? processed / elapsedSeconds
            : processed;

        await completeChunk(
          chunk.id,
          processed,
          chunkEnd.toString(),
          throughput
        );

        chunksProcessed++;
      } else {
        break;
      }
    }

    const finalJob = await getJob(jobId);

    if (
      finalJob &&
      finalJob.completed_chunks >=
        finalJob.total_chunks
    ) {
      await updateJobStatus(
        jobId,
        "completed"
      );
    }

    await writeLog({
      jobId,
      event: "worker_finished",
      message: "Worker finished",
      details: {
        workerId,
        chunksProcessed,
        operations: totalOperations,
        elapsedSeconds:
          (Date.now() - workerStart) / 1000
      }
    });

    return {
      workerId,
      chunksProcessed,
      operations: totalOperations
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    await writeLog({
      jobId,
      level: "error",
      event: "worker_failed",
      message,
      details: {
        workerId
      }
    });

    await updateJobStatus(
      jobId,
      "failed",
      { error: message }
    );

    throw error;
  }
}
