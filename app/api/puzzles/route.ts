import { NextResponse } from "next/server";
import { listPuzzleFixtures } from "@/lib/puzzles";

export async function GET() {
  try {
    const puzzles = listPuzzleFixtures().map((puzzle) => ({
      id: puzzle.id,
      name: puzzle.name,
      address: puzzle.address,
      rangeStart: puzzle.rangeStart,
      rangeEnd: puzzle.rangeEnd
    }));

    return NextResponse.json({ puzzles });
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
