import { describe, expect, it } from 'vitest';

import { eurShort, eurSign, pct, pctValue, questions, signed, years } from '../format';

const NBSP = ' ';

describe('formátovanie', () => {
  it('oddeľuje jednotku pevnou medzerou, aby sa nezalomila', () => {
    // Regresia: „18 %" sa v nadpise zalomilo na „18" a „% úspor".
    expect(pct(0.18, 0)).toBe(`18${NBSP}%`);
    expect(pctValue(62.5)).toBe(`62,5${NBSP}%`);
    expect(eurSign(1500)).toContain(`${NBSP}€`);
    expect(eurShort(141_417)).toBe(`141${NBSP}tis.`);
    expect(pct(0.18, 0)).not.toContain(' %');
  });

  it('používa slovenskú desatinnú čiarku', () => {
    expect(pctValue(7.6, 2)).toContain(',');
    expect(pctValue(7.6, 2)).not.toContain('.');
  });

  it('znamienko používa typografický mínus', () => {
    expect(signed(-3100)[0]).toBe('−');
    expect(signed(12_400)[0]).toBe('+');
  });

  it('skloňuje podľa slovenských pravidiel', () => {
    expect(years(1)).toBe('1 rok');
    expect(years(3)).toBe('3 roky');
    expect(years(30)).toBe('30 rokov');
    expect(questions(1)).toBe('1 otázka');
    expect(questions(4)).toBe('4 otázky');
    expect(questions(16)).toBe('16 otázok');
  });
});
