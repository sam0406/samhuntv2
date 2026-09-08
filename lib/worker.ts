import { randomUUID } from "crypto";
import { getJob, updateJobProgress, updateJobStatus } from "@/lib/jobs";
import {
  claimNextChunk,
  completeChunk,
  recoverStaleChunks,
  releaseChunk,
  updateChunkProgress,
} from "@/lib/queue";
import { writeLog } from "@/lib/logger";

interface RunWorkerOptions {
  jobId: string;
  workerId?: string;
  operationsPerStep?: number;
  maxSteps?: number;
  staleSeconds?: number;
}

interface WorkerResult {
  workerId: string;
  processed: string;
  completedChunks: number;
  totalChunks: number;
  status: string;
  message: string;
}

function benchmarkOperation(value: bigint): bigint {
  let result = value;

  for (let round = 0; round < 32; round += 1) {
    result ^= result << 13n;
    result ^= result >> 7n;
    result ^= result << 17n;
    result &= (1n << 256n) - 1n;
  }

  return result;
}

function calculateChunkProcessed(
  chunkStart: bigint,
  chunkEnd: bigint,
  checkpoint: string | null,
): bigint {
  if (!checkpoint) {
    return 0n;
  }

  const checkpointValue = BigInt(checkpoint);

  if (checkpointValue < chunkStart) {
    return 0n;
  }

  if (checkpointValue > chunkEnd) {
    return chunkEnd - chunkStart + 1n;
  }

  return checkpointValue - chunkStart + 1n;
}

export async function runWorker({
  jobId,
  workerId = `worker-${randomUUID()}`,
  operationsPerStep = 1000,
  maxSteps = 100,
  staleSeconds = 300,
}: RunWorkerOptions): Promise<WorkerResult> {
  if (!Number.isSafeInteger(operationsPerStep) || operationsPerStep <= 0) {
    throw new Error("operationsPerStep must be a positive safe integer");
  }

  if (!Number.isSafeInteger(maxSteps) || maxSteps <= 0) {
    throw new Error("maxSteps must be a positive safe integer");
  }

  const initialJob = await getJob(jobId);

  if (!initialJob) {
    throw new Error("Job not found");
  }

  if (
    initialJob.status === "completed" ||
    initialJob.status === "failed" ||
    initialJob.status === "stopped"
  ) {
    return {
      workerId,
      processed: String(initialJob.processed),
      completedChunks: initialJob.completed_chunks,
      totalChunks: initialJob.total_chunks,
      status: initialJob.status,
      message: "Job is already finished",
    };
  }

  await recoverStaleChunks(jobId, staleSeconds);

  await updateJobStatus(jobId, "running");

  await writeLog({
    jobId,
    event: "worker_started",
    message: `Benchmark worker ${workerId} started`,
    details: {
      workerId,
      operationsPerStep,
      maxSteps,
    },
  });

  let totalProcessed = 0n;
  let steps = 0;

  try {
    while (steps < maxSteps) {
      const currentJob = await getJob(jobId);

      if (!currentJob) {
        throw new Error("Job disappeared while worker was running");
      }

      if (currentJob.status === "paused") {
        await writeLog({
          jobId,
          event: "worker_paused",
          message: `Worker ${workerId} stopped because the job is paused`,
          details: { workerId },
        });

        return {
          workerId,
          processed: String(currentJob.processed),
          completedChunks: currentJob.completed_chunks,
          totalChunks: currentJob.total_chunks,
          status: "paused",
          message: "Job is paused",
        };
      }

      if (currentJob.status === "stopped") {
        await writeLog({
          jobId,
          event: "worker_stopped",
          message: `Worker ${workerId} stopped because the job was stopped`,
          details: { workerId },
        });

        return {
          workerId,
          processed: String(currentJob.processed),
          completedChunks: currentJob.completed_chunks,
          totalChunks: currentJob.total_chunks,
          status: "stopped",
          message: "Job was stopped",
        };
      }

      const chunk = await claimNextChunk(jobId, workerId);

      if (!chunk) {
        const refreshedJob = await getJob(jobId);

        if (!refreshedJob) {
          throw new Error("Job disappeared while checking completion");
        }

        if (refreshedJob.completed_chunks >= refreshedJob.total_chunks) {
          await updateJobStatus(jobId, "completed");

          await writeLog({
            jobId,
            event: "worker_finished",
            message: `Worker ${workerId} confirmed job completion`,
            details: {
              workerId,
              completedChunks: refreshedJob.completed_chunks,
              totalChunks: refreshedJob.total_chunks,
            },
          });

          return {
            workerId,
            processed: String(refreshedJob.processed),
            completedChunks: refreshedJob.completed_chunks,
            totalChunks: refreshedJob.total_chunks,
            status: "completed",
            message: "All benchmark chunks completed",
          };
        }

        steps += 1;
        continue;
      }

      const chunkStart = BigInt(chunk.range_start);
      const chunkEnd = BigInt(chunk.range_end);

      let processedInChunk = calculateChunkProcessed(
        chunkStart,
        chunkEnd,
        chunk.last_checkpoint,
      );

      let current = chunkStart + processedInChunk;

      const remaining =
        chunkEnd >= current ? chunkEnd - current + 1n : 0n;

      const operationsThisStep =
        remaining < BigInt(operationsPerStep)
          ? Number(remaining)
          : operationsPerStep;

      const stepStarted = Date.now();

      for (let i = 0; i < operationsThisStep; i += 1) {
        benchmarkOperation(current);
        current += 1n;
        processedInChunk += 1n;
      }

      const elapsedSeconds = Math.max(
        (Date.now() - stepStarted) / 1000,
        0.001,
      );

      const throughput = operationsThisStep / elapsedSeconds;

      const checkpoint =
        processedInChunk > 0n
          ? (chunkStart + processedInChunk - 1n).toString()
          : chunkStart.toString();

      await updateChunkProgress(
        chunk.id,
        operationsThisStep,
        checkpoint,
        throughput,
      );

      await updateJobProgress(
        jobId,
        operationsThisStep,
        checkpoint,
      );

      totalProcessed += BigInt(operationsThisStep);

      const chunkFinished = current > chunkEnd;

      if (chunkFinished) {
        await completeChunk(chunk.id, checkpoint);
      } else {
        await releaseChunk(chunk.id, checkpoint);
      }

      steps += 1;

      await writeLog({
        jobId,
        chunkId: chunk.id,
        event: "worker_step_completed",
        message: `Worker ${workerId} processed ${operationsThisStep} operations`,
        details: {
          workerId,
          operations: operationsThisStep,
          checkpoint,
          throughput,
          chunkFinished,
        },
      });

      if (chunkFinished) {
        continue;
      }
    }

    const finalJob = await getJob(jobId);

    if (!finalJob) {
      throw new Error("Job not found after worker execution");
    }

    const allComplete =
      finalJob.completed_chunks >= finalJob.total_chunks;

    if (allComplete) {
      await updateJobStatus(jobId, "completed");

      const completedJob = await getJob(jobId);

      return {
        workerId,
        processed: String(
          completedJob?.processed ?? finalJob.processed,
        ),
        completedChunks:
          completedJob?.completed_chunks ?? finalJob.completed_chunks,
        totalChunks: finalJob.total_chunks,
        status: "completed",
        message: "All benchmark chunks completed",
      };
    }

    await writeLog({
      jobId,
      event: "worker_budget_exhausted",
      message: `Worker ${workerId} reached its execution-step limit`,
      details: {
        workerId,
        maxSteps,
        totalProcessed: totalProcessed.toString(),
      },
    });

    return {
      workerId,
      processed: String(finalJob.processed),
      completedChunks: finalJob.completed_chunks,
      totalChunks: finalJob.total_chunks,
      status: finalJob.status,
      message: `Worker stopped after ${maxSteps} execution steps; checkpoint is persisted`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    await updateJobStatus(jobId, "failed", {
      error: message,
    });

    await writeLog({
      jobId,
      level: "error",
      event: "worker_failed",
      message: `Worker ${workerId} failed`,
      details: {
        workerId,
        error: message,
        totalProcessed: totalProcessed.toString(),
      },
    });

    throw error;
  }
}
