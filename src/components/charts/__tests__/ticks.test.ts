import { describe, expect, it } from 'vitest';

import { niceTicks } from '../primitives';

describe('niceTicks', () => {
  it('posledná značka nikdy neleží pod maximom dát', () => {
    // Toto je podmienka správnosti: horná značka určuje rozsah osi, takže
    // nižšia hodnota by znamenala, že sa dáta vykreslia mimo plochy grafu.
    const cases = [
      0.076, 0.0912, 0.021, 0.152, 1, 7, 42, 999, 1234, 54_000, 141_417, 260_281, 1_450_000,
    ];
    for (const max of cases) {
      const ticks = niceTicks(max, 4);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });

  it('začína nulou a je rastúca s rovnomerným krokom', () => {
    for (const max of [0.0912, 141_417, 3.5]) {
      const ticks = niceTicks(max, 4);
      expect(ticks[0]).toBe(0);
      const step = ticks[1] - ticks[0];
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i] - ticks[i - 1]).toBeCloseTo(step, 9);
      }
    }
  });

  it('nevracia viac značiek, než je potrebné', () => {
    for (const max of [0.0912, 141_417, 87, 1_000_000]) {
      const ticks = niceTicks(max, 4);
      expect(ticks.length).toBeLessThanOrEqual(7);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      // Predposledná značka musí ležať pod maximom, inak je os zbytočne vysoká.
      expect(ticks[ticks.length - 2]).toBeLessThan(max);
    }
  });

  it('popisky neobsahujú artefakty plávajúcej čiarky', () => {
    for (const max of [0.0912, 0.35, 1.05]) {
      for (const t of niceTicks(max, 4)) {
        expect(String(t).replace('-', '').length).toBeLessThanOrEqual(8);
      }
    }
  });

  it('nezmyselný vstup nezhodí graf', () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(-5)).toEqual([0]);
    expect(niceTicks(Number.NaN)).toEqual([0]);
  });
});
