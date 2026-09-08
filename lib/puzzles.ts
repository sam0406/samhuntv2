export interface PuzzleFixture {
  id: number;
  name: string;
  description: string;
  rangeStart: string;
  rangeEnd: string;
  benchmark: {
    expectedCheckpoint: string;
    expectedOperations: string;
  };
}

const PUZZLE_FIXTURES: PuzzleFixture[] = [
  {
    id: 69,
    name: "Bitcoin Puzzle 69",
    description:
      "Public solved puzzle used as an infrastructure benchmark fixture.",
    rangeStart: "0x100000000000000000",
    rangeEnd: "0x1fffffffffffffffff",
    benchmark: {
      expectedCheckpoint:
        "0x100000000000000000",
      expectedOperations: "1",
    },
  },
];

export function getPuzzleFixtures(): PuzzleFixture[] {
  return PUZZLE_FIXTURES.map((puzzle) => ({
    ...puzzle,
    benchmark: {
      ...puzzle.benchmark,
    },
  }));
}

export function getPuzzleFixture(
  puzzleId: number,
): PuzzleFixture | null {
  return (
    PUZZLE_FIXTURES.find(
      (puzzle) => puzzle.id === puzzleId,
    ) ?? null
  );
}
