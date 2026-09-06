import {
  claimNextChunk,
  completeChunk,
  recoverStaleChunks,
  releaseChunk,
  updateChunkProgress
} from "@/lib/queue";
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
  staleSeconds?: number;
}
interface WorkerResult {
  workerId: string;
  chunksProcessed: number;
  operations: number;
  stoppedByStepLimit: boolean;
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
  maxSteps = 100,
  staleSeconds = 300
}: WorkerOptions): Promise<WorkerResult> {
  if (operationsPerStep <= 0) {
    throw new Error(
      "operationsPerStep must be greater than zero"
    );
  }
  if (maxSteps <= 0) {
    throw new Error(
      "maxSteps must be greater than zero"
    );
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
  await recoverStaleChunks(
    jobId,
    staleSeconds
  );
  await updateJobStatus(
    jobId,
    "running"
  );
  await writeLog({
    jobId,
    event: "worker_started",
    message: "Worker started",
    details: {
      workerId,
      operationsPerStep,
      maxSteps,
      staleSeconds
    }
  });
  const workerStart = Date.now();
  let chunksProcessed = 0;
  let totalOperations = 0;
  let steps = 0;
  let stoppedByStepLimit = false;
  try {
    while (steps < maxSteps) {
      const currentJob = await getJob(jobId);
      if (!currentJob) {
        throw new Error(
          `Job ${jobId} no longer exists`
        );
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
      const chunkStart = BigInt(
        chunk.range_start
      );
      const chunkEnd = BigInt(
        chunk.range_end
      );
      /*
       * Resume immediately after the last checkpoint.
       *
       * last_checkpoint is the last value that was successfully
       * processed. Therefore the next value is checkpoint + 1.
       */
      let current = chunk.last_checkpoint
        ? BigInt(chunk.last_checkpoint) + 1n
        : chunkStart;
      if (current < chunkStart) {
        current = chunkStart;
      }
      const chunkAlreadyProcessed =
        chunk.last_checkpoint
          ? current - chunkStart
          : 0n;
      let processed =
        chunkAlreadyProcessed <=
        BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(chunkAlreadyProcessed)
          : 0;
      const chunkStarted = Date.now();
      if (current > chunkEnd) {
        await completeChunk(
          chunk.id,
          processed,
          chunkEnd.toString(),
          0
        );
        chunksProcessed++;
        continue;
      }
      let chunkReleased = false;
      while (
        current <= chunkEnd &&
        steps < maxSteps
      ) {
        const remaining =
          chunkEnd - current + 1n;
        const stepSize =
          remaining <
          BigInt(operationsPerStep)
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
            ? chunkEnd
            : current - 1n;
        await updateChunkProgress(
          chunk.id,
          processed,
          checkpoint.toString()
        );
        await updateJobProgress(
          jobId,
          stepSize,
          checkpoint.toString()
        );
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
        /*
         * We reached the worker's step limit.
         *
         * The checkpoint has already been persisted, so safely return
         * this chunk to the queue for another worker invocation.
         */
        await releaseChunk(chunk.id);
        chunkReleased = true;
        stoppedByStepLimit = true;
      }
      if (chunkReleased) {
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
        stoppedByStepLimit,
        elapsedSeconds:
          (Date.now() - workerStart) / 1000
      }
    });
    return {
      workerId,
      chunksProcessed,
      operations: totalOperations,
      stoppedByStepLimit
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
      {
        error: message
      }
    );
    throw error;
  }
}
