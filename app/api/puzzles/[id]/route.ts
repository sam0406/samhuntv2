import { NextRequest, NextResponse } from "next/server";
import { getPuzzleFixture } from "@/lib/puzzles";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const puzzleId = Number(id);

    if (!Number.isInteger(puzzleId)) {
      return NextResponse.json(
        { error: "Invalid puzzle ID" },
        { status: 400 }
      );
    }

    const puzzle = getPuzzleFixture(puzzleId);

    if (!puzzle) {
      return NextResponse.json(
        { error: "Puzzle not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      puzzle: {
        id: puzzle.id,
        name: puzzle.name,
        address: puzzle.address,
        rangeStart: puzzle.rangeStart,
        rangeEnd: puzzle.rangeEnd
      }
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
