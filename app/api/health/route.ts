import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const result = await sql`
      SELECT NOW() AS database_time
    `;

    return NextResponse.json({
      ok: true,
      service: "samhuntv2",
      database: "connected",
      databaseTime: result[0]?.database_time ?? null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        ok: false,
        service: "samhuntv2",
        database: "disconnected",
        error: message
      },
      { status: 500 }
    );
  }
}
