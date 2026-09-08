import { NextResponse } from "next/server";
import { runWorker } from "@/lib/worker";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        error: "Job ID is required",
      },
      { status: 400 },
    );
  }

  try {
    const result = await runWorker({
      jobId: id,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
