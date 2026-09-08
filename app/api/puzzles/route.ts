import { NextResponse } from "next/server";
import { getPuzzleFixtures } from "@/lib/puzzles";

export async function GET() {
  try {
    const puzzles = getPuzzleFixtures();

    return NextResponse.json({
      ok: true,
      puzzles,
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
