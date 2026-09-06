import { puzzle69Fixture } from "@/tests/fixtures/puzzle69";
import type { PuzzleBenchmarkFixture } from "@/tests/fixtures/puzzle69";

const fixtures: PuzzleBenchmarkFixture[] = [
  puzzle69Fixture
];

export function getPuzzleFixture(
  puzzleId: number
): PuzzleBenchmarkFixture | null {
  return fixtures.find((puzzle) => puzzle.id === puzzleId) ?? null;
}

export function listPuzzleFixtures(): PuzzleBenchmarkFixture[] {
  return [...fixtures];
}

export function validatePuzzleRange(
  puzzle: PuzzleBenchmarkFixture,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const puzzleStart = BigInt(puzzle.rangeStart);
  const puzzleEnd = BigInt(puzzle.rangeEnd);

  const start = BigInt(rangeStart);
  const end = BigInt(rangeEnd);

  return start >= puzzleStart && end <= puzzleEnd && start <= end;
}
