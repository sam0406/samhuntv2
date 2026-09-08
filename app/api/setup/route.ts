import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Database setup is disabled through the public API. Run db/schema.sql through your database migration workflow instead.",
    },
    { status: 403 },
  );
}

export async function GET() {
  try {
    const result = await sql`
      SELECT
        current_database() AS database,
        NOW() AS server_time
    `;

    return NextResponse.json({
      ok: true,
      database: result[0]?.database ?? null,
      serverTime: result[0]?.server_time ?? null,
      setup: "disabled",
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
