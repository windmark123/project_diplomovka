/**
 * Monte Carlo simulácia akumulačnej fázy.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * METODIKA
 * ────────────────────────────────────────────────────────────────────────────
 * Ročné výnosy tried aktív sa modelujú ako logaritmicko-normálne rozdelené
 * a vzájomne korelované náhodné veličiny:
 *
 *   σ_log = √( ln(1 + σ² / (1 + μ)²) )
 *   μ_log = ln(1 + μ) − σ_log² / 2
 *   R_i   = exp(μ_log + σ_log · z_i) − 1
 *
 * Logaritmicko-normálne rozdelenie je zvolené preto, že na rozdiel od
 * normálneho nedovolí výnos pod −100 %, čo je pri viacročnej simulácii
 * podstatné. Korelácia medzi triedami sa zavádza Choleského rozkladom
 * korelačnej matice: z = L · u, kde u sú nezávislé N(0,1).
 *
 * Generátor je deterministický a inicializovaný pevným semienkom. Rovnaké
 * vstupy preto vždy dávajú rovnaké výsledky — bez toho by výstupy práce
 * neboli reprodukovateľné.
 */

import { ASSET_CLASS_IDS, CORRELATION, assetClass, type AssetClassId } from '@/data/assets';
import { MACRO } from '@/data/pillars';
import {
  empiricalMetrics,
  maxDrawdown,
  mean,
  percentile,
  stdDev,
  deflate,
  type EmpiricalMetrics,
} from '@/engine/metrics';
import {
  allocationAtYear,
  normalizeAllocation,
  weightedTer,
  type Allocation,
  type FundSelection,
  type GlidepathConfig,
  DEFAULT_GLIDEPATH,
} from '@/engine/portfolio';

// ───────────────────────────────────────────────────────────────────────────
// Deterministický generátor náhodných čísel
// ───────────────────────────────────────────────────────────────────────────

/** Mulberry32 — rýchly 32-bitový PRNG s dobrými štatistickými vlastnosťami. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box–Mullerova transformácia — dvojica nezávislých N(0,1) z dvoch
 * rovnomerne rozdelených čísel. Vracia generátor s uloženou druhou hodnotou.
 */
export function normalGenerator(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = rng();
    // log(0) je −∞; posunieme vzorku mimo nuly.
    if (u < 1e-12) u = 1e-12;
    const v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    const theta = 2 * Math.PI * v;
    spare = r * Math.sin(theta);
    return r * Math.cos(theta);
  };
}

/**
 * Choleského rozklad symetrickej pozitívne definitnej matice: A = L · Lᵀ.
 * Pri numericky nepresnej matici sa diagonála zospodu oreže na malé kladné
 * číslo, takže rozklad nikdy nezlyhá na zaokrúhľovacej chybe.
 */
export function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(1e-12, matrix[i][i] - sum));
      } else {
        L[i][j] = (matrix[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

const correlationMatrix = (): number[][] =>
  ASSET_CLASS_IDS.map((i) => ASSET_CLASS_IDS.map((j) => CORRELATION[i][j]));

/** Parametre logaritmicko-normálneho rozdelenia pre triedu aktív. */
const logNormalParams = (id: AssetClassId) => {
  const { nominalReturn: mu, volatility: sigma } = assetClass(id).stats;
  const sigmaLog = Math.sqrt(Math.log(1 + (sigma * sigma) / Math.pow(1 + mu, 2)));
  const muLog = Math.log(1 + mu) - (sigmaLog * sigmaLog) / 2;
  return { muLog, sigmaLog };
};

// ───────────────────────────────────────────────────────────────────────────
// Simulácia
// ───────────────────────────────────────────────────────────────────────────

export interface SimulationInput {
  allocation: Allocation;
  funds: FundSelection;
  monthly: number;
  years: number;
  glidepath?: GlidepathConfig;
  contributionGrowth?: number;
  inflation?: number;
  /** Počet simulovaných ciest. */
  paths?: number;
  /** Semienko generátora — fixné kvôli reprodukovateľnosti. */
  seed?: number;
}

export interface PercentileBand {
  year: number;
  invested: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface SimulationResult {
  /** Pásma hodnoty portfólia po rokoch. */
  bands: PercentileBand[];
  /** Zoradené konečné hodnoty všetkých ciest. */
  finals: number[];
  /** Vybrané percentily konečnej hodnoty. */
  terminal: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    mean: number;
    /** Medián v reálnom vyjadrení. */
    medianReal: number;
  };
  invested: number;
  /** Pravdepodobnosť, že konečná hodnota nedosiahne vloženú sumu. */
  probBelowInvested: number;
  /** Pravdepodobnosť, že konečná hodnota nedosiahne vloženú sumu v reálnej hodnote. */
  probBelowInvestedReal: number;
  /** Empirické ukazovatele z ročných výnosov portfólia naprieč cestami. */
  metrics: EmpiricalMetrics;
  /** Rozdelenie maximálneho poklesu (na indexe zhodnotenia, nie na hodnote účtu). */
  drawdown: { median: number; p95: number; worst: number };
  /** Anualizovaný výnos portfólia — medián naprieč cestami. */
  annualizedMedian: number;
  paths: number;
  seed: number;
}

export const DEFAULT_PATHS = 2000;
export const DEFAULT_SEED = 20260922;

export function simulate(input: SimulationInput): SimulationResult {
  const {
    allocation,
    funds,
    monthly,
    years,
    glidepath = DEFAULT_GLIDEPATH,
    contributionGrowth = 0,
    inflation = MACRO.inflation.value,
    paths = DEFAULT_PATHS,
    seed = DEFAULT_SEED,
  } = input;

  const n = ASSET_CLASS_IDS.length;
  const L = cholesky(correlationMatrix());
  const params = ASSET_CLASS_IDS.map((id) => logNormalParams(id));

  // Váhy tried aktív pre každý rok horizontu (glide path ich mení).
  const yearWeights: number[][] = [];
  const yearTer: number[] = [];
  for (let y = 0; y < years; y++) {
    const a = normalizeAllocation(allocationAtYear(allocation, years - y, glidepath));
    yearWeights.push(ASSET_CLASS_IDS.map((id) => a[id] / 100));
    yearTer.push(weightedTer(a, funds));
  }

  const rng = mulberry32(seed);
  const normal = normalGenerator(rng);

  // valuesByYear[y] zbiera hodnoty portfólia na konci roka y+1 naprieč cestami.
  const valuesByYear: number[][] = Array.from({ length: years }, () => new Array(paths).fill(0));
  const finals = new Array<number>(paths);
  const drawdowns = new Array<number>(paths);
  const annualized = new Array<number>(paths);
  const allReturns: number[] = [];

  const u = new Array<number>(n);
  const z = new Array<number>(n);

  let investedTotal = 0;

  for (let p = 0; p < paths; p++) {
    let value = 0;
    let invested = 0;
    let index = 1; // index zhodnotenia bez vplyvu vkladov
    const indexPath: number[] = [1];

    for (let y = 0; y < years; y++) {
      for (let i = 0; i < n; i++) u[i] = normal();
      // z = L · u  →  korelované normálne veličiny
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let k = 0; k <= i; k++) s += L[i][k] * u[k];
        z[i] = s;
      }

      const w = yearWeights[y];
      let portfolioReturn = 0;
      for (let i = 0; i < n; i++) {
        if (w[i] === 0) continue;
        const { muLog, sigmaLog } = params[i];
        portfolioReturn += w[i] * (Math.exp(muLog + sigmaLog * z[i]) - 1);
      }
      portfolioReturn -= yearTer[y];

      allReturns.push(portfolioReturn);
      index *= 1 + portfolioReturn;
      indexPath.push(index);

      const contribution = monthly * Math.pow(1 + contributionGrowth, y);
      const m = Math.pow(1 + Math.max(-0.99, portfolioReturn), 1 / 12) - 1;
      for (let k = 0; k < 12; k++) {
        value = value * (1 + m) + contribution;
        invested += contribution;
      }

      valuesByYear[y][p] = value;
    }

    finals[p] = value;
    drawdowns[p] = maxDrawdown(indexPath);
    annualized[p] = years > 0 ? Math.pow(Math.max(1e-9, index), 1 / years) - 1 : 0;
    investedTotal = invested;
  }

  // Percentilové pásma po rokoch.
  const bands: PercentileBand[] = [{ year: 0, invested: 0, p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 }];
  for (let y = 0; y < years; y++) {
    const sorted = [...valuesByYear[y]].sort((a, b) => a - b);
    let investedToYear = 0;
    for (let k = 0; k <= y; k++) investedToYear += monthly * Math.pow(1 + contributionGrowth, k) * 12;
    bands.push({
      year: y + 1,
      invested: investedToYear,
      p5: percentile(sorted, 0.05),
      p25: percentile(sorted, 0.25),
      p50: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      p95: percentile(sorted, 0.95),
    });
  }

  const sortedFinals = [...finals].sort((a, b) => a - b);
  const sortedDrawdowns = [...drawdowns].sort((a, b) => a - b);
  const sortedAnnualized = [...annualized].sort((a, b) => a - b);

  const median = percentile(sortedFinals, 0.5);
  // Prah pre reálne vyjadrenie: vložená suma navýšená o infláciu za horizont.
  const realThreshold = investedTotal * Math.pow(1 + inflation, years);

  return {
    bands,
    finals: sortedFinals,
    terminal: {
      p5: percentile(sortedFinals, 0.05),
      p25: percentile(sortedFinals, 0.25),
      p50: median,
      p75: percentile(sortedFinals, 0.75),
      p95: percentile(sortedFinals, 0.95),
      mean: mean(sortedFinals),
      medianReal: deflate(median, inflation, years),
    },
    invested: investedTotal,
    probBelowInvested: sortedFinals.filter((v) => v < investedTotal).length / paths,
    probBelowInvestedReal: sortedFinals.filter((v) => v < realThreshold).length / paths,
    metrics: empiricalMetrics(allReturns, assetClass('cash').stats.nominalReturn),
    drawdown: {
      median: percentile(sortedDrawdowns, 0.5),
      p95: percentile(sortedDrawdowns, 0.05),
      worst: sortedDrawdowns[0] ?? 0,
    },
    annualizedMedian: percentile(sortedAnnualized, 0.5),
    paths,
    seed,
  };
}

/** Smerodajná chyba mediánu konečnej hodnoty — kontrola dostatočnosti počtu ciest. */
export const simulationStandardError = (result: SimulationResult): number =>
  stdDev(result.finals) / Math.sqrt(result.paths);

