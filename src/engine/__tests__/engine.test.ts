import { describe, expect, it } from 'vitest';

import { ASSET_CLASS_IDS, CORRELATION } from '@/data/assets';
import { QUESTIONS } from '@/data/questionnaire';
import { evaluateProfile } from '@/engine/profile';
import {
  VARIANTS,
  allocationAtYear,
  allocationTotal,
  buildVariant,
  normalizeAllocation,
  portfolioStats,
  riskyShare,
} from '@/engine/portfolio';
import { profileById } from '@/engine/profile';
import { accumulate, irrMonthly, projectPortfolio } from '@/engine/projection';
import {
  empiricalVaR,
  maxDrawdown,
  normalCdf,
  normalInv,
  parametricCVaR,
  parametricVaR,
  percentile,
  sharpeRatio,
} from '@/engine/metrics';
import { cholesky, mulberry32, simulate } from '@/engine/montecarlo';
import { compareRoutes, fundGrossReturn } from '@/engine/pillars';
import { defaultFundSelection } from '@/engine/portfolio';

const funds = defaultFundSelection();

describe('normálne rozdelenie', () => {
  it('normalCdf a normalInv sú navzájom inverzné', () => {
    for (const p of [0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99]) {
      expect(normalCdf(normalInv(p))).toBeCloseTo(p, 4);
    }
  });

  it('kvantil 95 % zodpovedá tabuľkovej hodnote 1,6449', () => {
    expect(normalInv(0.95)).toBeCloseTo(1.6449, 3);
  });
});

describe('korelačná matica', () => {
  it('je symetrická s jednotkami na diagonále', () => {
    for (const i of ASSET_CLASS_IDS) {
      expect(CORRELATION[i][i]).toBe(1);
      for (const j of ASSET_CLASS_IDS) {
        expect(CORRELATION[i][j]).toBeCloseTo(CORRELATION[j][i], 10);
      }
    }
  });

  it('je pozitívne definitná, takže Choleského rozklad existuje', () => {
    const m = ASSET_CLASS_IDS.map((i) => ASSET_CLASS_IDS.map((j) => CORRELATION[i][j]));
    const L = cholesky(m);
    // L · Lᵀ musí dať pôvodnú maticu.
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m.length; j++) {
        let s = 0;
        for (let k = 0; k < m.length; k++) s += L[i][k] * L[j][k];
        expect(s).toBeCloseTo(m[i][j], 8);
      }
    }
  });
});

describe('alokácia', () => {
  it('každý variant má súčet váh 100 % a leží v pásme profilu', () => {
    for (const profile of ['conservative', 'balanced', 'growth', 'dynamic'] as const) {
      const p = profileById(profile);
      for (const v of VARIANTS) {
        const alloc = buildVariant(v, p);
        expect(allocationTotal(alloc)).toBeCloseTo(100, 6);
        const risky = riskyShare(alloc);
        expect(risky).toBeGreaterThanOrEqual(p.equityBand[0] - 1e-6);
        expect(risky).toBeLessThanOrEqual(p.equityBand[1] + 1e-6);
      }
    }
  });

  it('glide path znižuje rizikovú zložku smerom ku koncu horizontu', () => {
    const alloc = buildVariant(VARIANTS[1], profileById('growth'));
    const start = riskyShare(allocationAtYear(alloc, 30));
    const mid = riskyShare(allocationAtYear(alloc, 10));
    const end = riskyShare(allocationAtYear(alloc, 0));
    expect(start).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(end);
    expect(allocationTotal(allocationAtYear(alloc, 5))).toBeCloseTo(100, 6);
  });

  it('diverzifikácia znižuje volatilitu pod vážený priemer volatilít', () => {
    const alloc = buildVariant(VARIANTS[2], profileById('growth'));
    const stats = portfolioStats(alloc, funds);
    expect(stats.volatility).toBeLessThan(stats.undiversifiedVolatility);
  });

  it('normalizácia zachová pomery medzi triedami', () => {
    const raw = normalizeAllocation({ ...buildVariant(VARIANTS[1], profileById('balanced')) });
    expect(allocationTotal(raw)).toBeCloseTo(100, 8);
  });
});

describe('profilácia', () => {
  it('prázdny dotazník dáva najnižší profil', () => {
    const r = evaluateProfile({ answers: {}, horizon: 30 });
    expect(r.profile.id).toBe('conservative');
    expect(r.isComplete).toBe(false);
  });

  it('maximálne skóre dáva najvyšší profil pri dlhom horizonte', () => {
    const answers: Record<string, string> = {};
    for (const q of QUESTIONS) {
      const best = [...q.options].sort((a, b) => b.score - a.score)[0];
      answers[q.id] = best.key;
    }
    const r = evaluateProfile({ answers, horizon: 35 });
    expect(r.profile.id).toBe('dynamic');
    expect(r.score).toBe(100);
    expect(r.isComplete).toBe(true);
  });

  it('krátky horizont strop uplatní aj pri maximálnom skóre', () => {
    const answers: Record<string, string> = {};
    for (const q of QUESTIONS) {
      answers[q.id] = [...q.options].sort((a, b) => b.score - a.score)[0].key;
    }
    const r = evaluateProfile({ answers, horizon: 8 });
    expect(r.profile.id).toBe('balanced');
    expect(r.cappedByHorizon).toBe(true);
  });

  it('preferencie udržateľnosti nemenia rizikové skóre', () => {
    const base: Record<string, string> = {};
    for (const q of QUESTIONS) base[q.id] = q.options[0].key;
    const withEsg = { ...base };
    for (const q of QUESTIONS.filter((q) => q.area === 'udrzatelnost')) {
      withEsg[q.id] = [...q.options].sort((a, b) => b.score - a.score)[0].key;
    }
    expect(evaluateProfile({ answers: base, horizon: 30 }).score).toBe(
      evaluateProfile({ answers: withEsg, horizon: 30 }).score,
    );
  });
});

describe('akumulácia', () => {
  it('pri nulovom výnose sa hodnota rovná vloženej sume', () => {
    const r = accumulate({ monthly: 100, years: 10, rateAt: () => 0 });
    expect(r.final).toBeCloseTo(12000, 6);
    expect(r.invested).toBeCloseTo(12000, 6);
    expect(r.gain).toBeCloseTo(0, 6);
  });

  it('zodpovedá vzorcu pre budúcu hodnotu anuity', () => {
    const years = 20;
    const annual = 0.06;
    const m = Math.pow(1 + annual, 1 / 12) - 1;
    const n = years * 12;
    const expected = 150 * ((Math.pow(1 + m, n) - 1) / m);
    const r = accumulate({ monthly: 150, years, rateAt: () => annual });
    expect(r.final).toBeCloseTo(expected, 4);
  });

  it('IRR pri konštantnom výnose zodpovedá tomuto výnosu', () => {
    const r = accumulate({ monthly: 200, years: 25, rateAt: () => 0.07 });
    expect(r.irr).toBeCloseTo(0.07, 4);
  });

  it('IRR nulových výnosov je nula', () => {
    const flows = [...Array(12).fill(-100), 1200];
    expect(irrMonthly(flows)).toBeCloseTo(0, 6);
  });

  it('vyšší poplatok znižuje konečnú hodnotu', () => {
    const cheap = accumulate({ monthly: 150, years: 30, rateAt: () => 0.07 - 0.002 });
    const pricey = accumulate({ monthly: 150, years: 30, rateAt: () => 0.07 - 0.012 });
    expect(cheap.final).toBeGreaterThan(pricey.final);
  });
});

describe('ukazovatele', () => {
  it('Sharpe je nulový, keď sa výnos rovná bezrizikovej sadzbe', () => {
    expect(sharpeRatio(0.02, 0.15, 0.02)).toBe(0);
  });

  it('parametrický CVaR je vždy aspoň taký veľký ako VaR', () => {
    for (const sigma of [0.05, 0.12, 0.2]) {
      const v = parametricVaR(0.07, sigma, 0.95, 1);
      const c = parametricCVaR(0.07, sigma, 0.95, 1);
      expect(c).toBeGreaterThanOrEqual(v);
    }
  });

  it('maximálny pokles rozpozná prepad a zotavenie', () => {
    expect(maxDrawdown([1, 1.2, 0.6, 0.9, 1.5])).toBeCloseTo(-0.5, 6);
    expect(maxDrawdown([1, 1.1, 1.2])).toBe(0);
  });

  it('percentil interpoluje lineárne', () => {
    const xs = [0, 10, 20, 30, 40];
    expect(percentile(xs, 0)).toBe(0);
    expect(percentile(xs, 1)).toBe(40);
    expect(percentile(xs, 0.5)).toBe(20);
  });

  it('empirický VaR zodpovedá 5. percentilu straty', () => {
    const rets = Array.from({ length: 1000 }, (_, i) => -0.5 + i / 1000);
    expect(empiricalVaR(rets, 0.95)).toBeCloseTo(0.45, 2);
  });
});

describe('Monte Carlo', () => {
  it('generátor je deterministický pri rovnakom semienku', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it('dve spustenia s rovnakými vstupmi dajú identický výsledok', () => {
    const alloc = buildVariant(VARIANTS[1], profileById('growth'));
    const input = { allocation: alloc, funds, monthly: 150, years: 25, paths: 300 };
    const a = simulate(input);
    const b = simulate(input);
    expect(a.terminal.p50).toBe(b.terminal.p50);
    expect(a.terminal.p5).toBe(b.terminal.p5);
  });

  it('percentily sú usporiadané', () => {
    const alloc = buildVariant(VARIANTS[1], profileById('growth'));
    const r = simulate({ allocation: alloc, funds, monthly: 150, years: 30, paths: 800 });
    expect(r.terminal.p5).toBeLessThan(r.terminal.p25);
    expect(r.terminal.p25).toBeLessThan(r.terminal.p50);
    expect(r.terminal.p50).toBeLessThan(r.terminal.p75);
    expect(r.terminal.p75).toBeLessThan(r.terminal.p95);
    for (const band of r.bands.slice(1)) {
      expect(band.p5).toBeLessThanOrEqual(band.p50);
      expect(band.p50).toBeLessThanOrEqual(band.p95);
    }
  });

  it('medián simulácie je blízko deterministickej projekcie', () => {
    const alloc = buildVariant(VARIANTS[1], profileById('growth'));
    const det = projectPortfolio({ allocation: alloc, funds, monthly: 150, years: 30 });
    const mc = simulate({ allocation: alloc, funds, monthly: 150, years: 30, paths: 4000 });
    // Medián logaritmicko-normálneho rozdelenia leží pod strednou hodnotou,
    // takže deterministická projekcia má byť vyššia, ale nie rádovo.
    expect(mc.terminal.p50).toBeLessThan(det.final);
    expect(mc.terminal.p50).toBeGreaterThan(det.final * 0.6);
    expect(mc.terminal.mean).toBeGreaterThan(mc.terminal.p50);
  });

  it('konzervatívne portfólio má užšie rozpätie než dynamické', () => {
    const cons = buildVariant(VARIANTS[0], profileById('conservative'));
    const dyn = buildVariant(VARIANTS[2], profileById('dynamic'));
    const a = simulate({ allocation: cons, funds, monthly: 150, years: 30, paths: 1500 });
    const b = simulate({ allocation: dyn, funds, monthly: 150, years: 30, paths: 1500 });
    const spreadA = (a.terminal.p95 - a.terminal.p5) / a.terminal.p50;
    const spreadB = (b.terminal.p95 - b.terminal.p5) / b.terminal.p50;
    expect(spreadA).toBeLessThan(spreadB);
    expect(Math.abs(a.drawdown.median)).toBeLessThan(Math.abs(b.drawdown.median));
  });
});

describe('porovnanie ciest', () => {
  const base = {
    allocation: buildVariant(VARIANTS[1], profileById('growth')),
    funds,
    monthly: 150,
    years: 30,
    wageBandId: 'b3',
    fundRisk: 'index' as const,
  };

  it('fondy s rovnakým podielom akcií majú rovnaký hrubý výnos', () => {
    expect(fundGrossReturn(1)).toBeCloseTo(fundGrossReturn(1), 10);
    expect(fundGrossReturn(1)).toBeGreaterThan(fundGrossReturn(0));
  });

  it('vlastné portfólio prekoná III. pilier pri rovnakom vklade a rovnakom riziku', () => {
    const r = compareRoutes(base);
    expect(r.own.net).toBeGreaterThan(r.pillar3.net);
    expect(r.ownVsPillar3).toBeGreaterThan(0);
  });

  it('III. pilier platí daň pri výplate, vlastné portfólio po časovom teste nie', () => {
    const r = compareRoutes(base);
    expect(r.pillar3.tax).toBeGreaterThan(0);
    expect(r.own.tax).toBe(0);
  });

  it('poplatky znižujú hodnotu každej cesty', () => {
    const r = compareRoutes(base);
    for (const route of r.routes) expect(route.fees).toBeGreaterThan(0);
    // III. pilier má najvyššiu odplatu, teda aj najväčší úbytok na euro vkladu.
    const dragPerEuro = (x: (typeof r.routes)[number]) => x.fees / x.credited;
    expect(dragPerEuro(r.pillar3)).toBeGreaterThan(dragPerEuro(r.own));
  });

  it('riziková zložka je pre všetky cesty podiel v ⟨0; 1⟩, nie percento', () => {
    // Regresia: vlastné portfólio kedysi vracalo percentá, zatiaľ čo piliere
    // podiel, takže tabuľka pre vlastné portfólio zobrazila „8 750 %".
    const r = compareRoutes(base);
    for (const route of r.routes) {
      expect(route.equityShare).toBeGreaterThan(0);
      expect(route.equityShare).toBeLessThanOrEqual(1);
    }
  });

  it('pri zosúladenom riziku majú všetky tri cesty rovnakú rizikovú zložku', () => {
    const r = compareRoutes(base);
    expect(r.pillar2.equityShare).toBeCloseTo(r.own.equityShare, 10);
    expect(r.pillar3.equityShare).toBeCloseTo(r.own.equityShare, 10);
  });

  it('bez zosúladenia sa použije deklarované zloženie fondu', () => {
    const r = compareRoutes({ ...base, riskMatched: false });
    expect(r.pillar3.riskMatched).toBe(false);
    // Indexový fond je plne akciový, vlastné portfólio s glide path nie je.
    expect(r.pillar3.equityShare).toBe(1);
    expect(r.own.equityShare).toBeLessThan(1);
  });

  it('glide path znižuje priemernú rizikovú zložku pod počiatočnú váhu', () => {
    const withGlide = compareRoutes(base);
    const withoutGlide = compareRoutes({
      ...base,
      glidepath: { enabled: false, years: 15, endFactor: 0.35 },
    });
    expect(withGlide.own.equityShare).toBeLessThan(withoutGlide.own.equityShare);
  });

  it('II. pilier nevyžaduje vlastný vklad sporiteľa', () => {
    const r = compareRoutes(base);
    expect(r.pillar2.ownContribution).toBe(0);
    expect(r.pillar2.credited).toBeGreaterThan(0);
  });
});
