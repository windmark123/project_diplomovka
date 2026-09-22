/**
 * Deterministická projekcia akumulačnej fázy.
 *
 * Jadrom je funkcia `accumulate`, ktorú používajú všetky tri porovnávané cesty
 * — vlastné portfólio, II. aj III. pilier. Tým je zaručené, že rozdiely medzi
 * nimi vznikajú výlučne výnosom, poplatkom a daňou, nie odlišnou mechanikou
 * výpočtu. To je metodický predpoklad celého porovnania.
 *
 * Vklady prichádzajú mesačne na konci mesiaca, úročenie je mesačné pri sadzbe
 * (1 + r)^(1/12) − 1, teda geometricky konzistentné s anualizovaným výnosom.
 */

import { MACRO } from '@/data/pillars';
import { deflate } from '@/engine/metrics';
import {
  allocationAtYear,
  portfolioStats,
  riskyShare,
  type Allocation,
  type FundSelection,
  type GlidepathConfig,
  DEFAULT_GLIDEPATH,
} from '@/engine/portfolio';

export interface YearPoint {
  year: number;
  /** Kumulatívne vložená suma. */
  invested: number;
  /** Nominálna hodnota portfólia na konci roka. */
  value: number;
  /** Hodnota prepočítaná na kúpnu silu v čase 0. */
  real: number;
  /** Anualizovaný výnos použitý v danom roku (po poplatkoch). */
  rate: number;
  /** Podiel rizikovej zložky v danom roku (mení sa glide path). */
  risky: number;
}

export interface AccumulationResult {
  series: YearPoint[];
  /** Nominálna konečná hodnota. */
  final: number;
  /** Konečná hodnota v reálnom vyjadrení. */
  finalReal: number;
  /** Celková vložená suma. */
  invested: number;
  /** Zhodnotenie nad rámec vkladov. */
  gain: number;
  /**
   * Vnútorná miera výnosnosti (IRR) peňažných tokov p. a. Pri nepravidelných
   * vkladoch je jediným korektným meradlom dosiahnutého výnosu.
   */
  irr: number;
}

export interface AccumulationInput {
  /** Mesačný vklad v čase 0. */
  monthly: number;
  years: number;
  /** Medziročný rast vkladu (napr. indexácia mzdou). 0 = konštantný vklad. */
  contributionGrowth?: number;
  /** Poplatok strhnutý z každého vkladu (podiel, napr. 0,01 = 1 %). */
  entryFee?: number;
  /** Ročná miera zhodnotenia po poplatkoch pre daný rok (0-based index). */
  rateAt: (yearIndex: number) => number;
  /** Podiel rizikovej zložky v danom roku — len na vykreslenie. */
  riskyAt?: (yearIndex: number) => number;
  inflation?: number;
}

/** Mesačná miera zodpovedajúca anualizovanej sadzbe. */
const monthlyRate = (annual: number): number => Math.pow(1 + annual, 1 / 12) - 1;

export function accumulate(input: AccumulationInput): AccumulationResult {
  const {
    monthly,
    years,
    contributionGrowth = 0,
    entryFee = 0,
    rateAt,
    riskyAt,
    inflation = MACRO.inflation.value,
  } = input;

  const series: YearPoint[] = [
    { year: 0, invested: 0, value: 0, real: 0, rate: rateAt(0), risky: riskyAt ? riskyAt(0) : 0 },
  ];

  // Peňažné toky pre výpočet IRR indexované mesiacmi. Index 0 je začiatok
  // sporenia, keď ešte žiadny tok nenastal — prvý vklad prichádza na konci
  // prvého mesiaca. Konečná hodnota pripadá na rovnaký okamih ako posledný
  // vklad, preto sa k nemu pripočíta, nie pridá za neho.
  const flows: number[] = [0];

  let value = 0;
  let invested = 0;

  for (let y = 0; y < years; y++) {
    const annual = rateAt(y);
    const m = monthlyRate(annual);
    const contribution = monthly * Math.pow(1 + contributionGrowth, y);
    const credited = contribution * (1 - entryFee);

    for (let i = 0; i < 12; i++) {
      value = value * (1 + m) + credited;
      invested += contribution;
      flows.push(-contribution);
    }

    series.push({
      year: y + 1,
      invested,
      value,
      real: deflate(value, inflation, y + 1),
      rate: annual,
      risky: riskyAt ? riskyAt(y) : 0,
    });
  }

  flows[flows.length - 1] += value;

  return {
    series,
    final: value,
    finalReal: deflate(value, inflation, years),
    invested,
    gain: value - invested,
    irr: irrMonthly(flows),
  };
}

/**
 * IRR mesačných peňažných tokov, anualizovaná. Rieši sa bisekciou, ktorá je
 * pre tento tvar tokov (jedna zmena znamienka) vždy konvergentná — na rozdiel
 * od Newtonovej metódy, ktorá pri nulovom výnose diverguje.
 */
export function irrMonthly(flows: number[]): number {
  const npv = (rate: number): number =>
    flows.reduce((sum, f, t) => sum + f / Math.pow(1 + rate, t), 0);

  let lo = -0.9 / 12;
  let hi = 1.0 / 12;

  if (npv(lo) * npv(hi) > 0) return 0;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  const monthly = (lo + hi) / 2;
  return Math.pow(1 + monthly, 12) - 1;
}

export interface PortfolioProjectionInput {
  allocation: Allocation;
  funds: FundSelection;
  monthly: number;
  years: number;
  glidepath?: GlidepathConfig;
  contributionGrowth?: number;
  inflation?: number;
}

/**
 * Projekcia vlastného portfólia. Ročná miera výnosu sa prepočíta pre každý rok
 * zvlášť, pretože glide path v priebehu horizontu mení zloženie portfólia
 * a tým aj jeho očakávaný výnos.
 */
export function projectPortfolio(input: PortfolioProjectionInput): AccumulationResult & {
  /** Štatistiky portfólia v počiatočnom zložení. */
  initialStats: ReturnType<typeof portfolioStats>;
  /** Štatistiky portfólia v poslednom roku horizontu. */
  finalStats: ReturnType<typeof portfolioStats>;
} {
  const { allocation, funds, monthly, years, glidepath = DEFAULT_GLIDEPATH } = input;

  const statsAt = (yearIndex: number) =>
    portfolioStats(allocationAtYear(allocation, years - yearIndex, glidepath), funds);

  const result = accumulate({
    monthly,
    years,
    contributionGrowth: input.contributionGrowth,
    inflation: input.inflation,
    rateAt: (y) => statsAt(y).expectedReturn,
    riskyAt: (y) => riskyShare(allocationAtYear(allocation, years - y, glidepath)),
  });

  return {
    ...result,
    initialStats: portfolioStats(allocation, funds),
    finalStats: statsAt(Math.max(0, years - 1)),
  };
}

/**
 * Priemerná riziková váha počas celého horizontu. Používa sa pri výpočte
 * ukazovateľov, aby glide path nebol ignorovaný — portfólio, ktoré posledných
 * 15 rokov znižuje riziko, má nižšiu efektívnu volatilitu než jeho počiatočné
 * zloženie naznačuje.
 */
export function averageAllocation(
  allocation: Allocation,
  years: number,
  glidepath: GlidepathConfig = DEFAULT_GLIDEPATH,
): Allocation {
  const acc = { ...allocation };
  for (const key of Object.keys(acc) as Array<keyof Allocation>) acc[key] = 0;

  for (let y = 0; y < years; y++) {
    const a = allocationAtYear(allocation, years - y, glidepath);
    for (const key of Object.keys(a) as Array<keyof Allocation>) {
      acc[key] += a[key] / years;
    }
  }
  return acc;
}
