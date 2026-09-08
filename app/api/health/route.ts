import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const startedAt = Date.now();

  try {
    const result = await sql`
      SELECT NOW() AS server_time
    `;

    return NextResponse.json({
      ok: true,
      status: "healthy",
      database: "connected",
      serverTime: result[0]?.server_time ?? null,
      responseTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        database: "disconnected",
        error: message,
        responseTimeMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
