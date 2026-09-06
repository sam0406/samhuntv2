import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { getJobLogs } from "@/lib/logger";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const job = await getJob(id);

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    const limitValue =
      request.nextUrl.searchParams.get("limit");

    const parsedLimit = limitValue
      ? Number(limitValue)
      : 200;

    const limit =
      Number.isInteger(parsedLimit) &&
      parsedLimit > 0 &&
      parsedLimit <= 1000
        ? parsedLimit
        : 200;

    const logs = await getJobLogs(id, limit);

    return NextResponse.json({
      jobId: id,
      logs
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
