/** Ear-training round generation (deterministic with a seed, so it is testable). */
export interface HigherLowerRound {
  first: number;
  second: number;
  answer: 'first' | 'second';
}

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Two different notes from the pool per round; never equal, so an answer always exists. */
export function higherLowerRounds(pool: readonly number[], rounds: number, seed: number): HigherLowerRound[] {
  const rnd = mulberry(seed);
  const out: HigherLowerRound[] = [];
  for (let i = 0; i < rounds; i++) {
    const a = pool[Math.floor(rnd() * pool.length)]!;
    let b = a;
    while (b === a) b = pool[Math.floor(rnd() * pool.length)]!;
    out.push({ first: a, second: b, answer: a > b ? 'first' : 'second' });
  }
  return out;
}
