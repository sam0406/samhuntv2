export interface PuzzleBenchmarkFixture {
  id: number;
  name: string;
  address: string;
  rangeStart: string;
  rangeEnd: string;
  expectedBenchmark: string;
}

export const puzzle69Fixture: PuzzleBenchmarkFixture = {
  id: 69,
  name: "Bitcoin Puzzle 69",
  address: "19vkiEajfhuZ8bs8Zu2jgmC6oqZbWqhxhG",
  rangeStart: "0x100000000000000000",
  rangeEnd: "0x1fffffffffffffffff",

  // Deterministic infrastructure-test value.
  // This is NOT a Bitcoin private key or recovery result.
  expectedBenchmark: "PUZZLE69_BENCHMARK_OK"
};
