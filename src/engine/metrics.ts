/**
 * Rizikovo-výnosové ukazovatele.
 *
 * Modul obsahuje dve skupiny funkcií:
 *
 *   • analytické — počítané v uzavretom tvare z očakávaného výnosu a
 *     volatility pri predpoklade normálneho rozdelenia ročných výnosov,
 *   • empirické — počítané z konkrétnych realizácií, teda z ciest
 *     vygenerovaných Monte Carlo simuláciou.
 *
 * Práca uvádza obe: analytické preto, že sú reprodukovateľné a porovnateľné
 * naprieč variantmi bez ohľadu na simuláciu, empirické preto, že nepredpokladajú
 * normalitu a zachytávajú aj šikmosť, ktorú pravidelné vklady do rozdelenia
 * konečnej hodnoty vnášajú.
 */

// ───────────────────────────────────────────────────────────────────────────
// Normálne rozdelenie
// ───────────────────────────────────────────────────────────────────────────

export const normalPdf = (z: number): number =>
  Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

/** Distribučná funkcia N(0,1) cez Abramowitz–Stegun aproximáciu erf. */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Inverzná distribučná funkcia N(0,1) — racionálna aproximácia podľa
 * P. J. Acklama s presnosťou rádovo 1e-9 na celom intervale.
 */
export function normalInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
             -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
             3.754408661907416];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// ───────────────────────────────────────────────────────────────────────────
// Analytické ukazovatele
// ───────────────────────────────────────────────────────────────────────────

/**
 * Sharpeho pomer: (R_p − R_f) / σ_p.
 * Vyjadruje, koľko nadvýnosu nad bezrizikovou sadzbou pripadá na jednotku
 * celkovej volatility.
 */
export const sharpeRatio = (expectedReturn: number, volatility: number, riskFree: number): number =>
  volatility > 0 ? (expectedReturn - riskFree) / volatility : 0;

/**
 * Parametrická hodnota v riziku (VaR) na hladine `alpha` pre horizont
 * `years` rokov. Vracia kladné číslo ako veľkosť straty v podiele majetku.
 *
 * Pri predpoklade i.i.d. ročných výnosov platí μ_T = μ·T a σ_T = σ·√T.
 */
export function parametricVaR(
  expectedReturn: number,
  volatility: number,
  alpha = 0.95,
  years = 1,
): number {
  const mu = expectedReturn * years;
  const sigma = volatility * Math.sqrt(years);
  const quantile = mu + normalInv(1 - alpha) * sigma;
  return Math.max(0, -quantile);
}

/**
 * Podmienená hodnota v riziku (CVaR / Expected Shortfall) — priemerná strata
 * v tých scenároch, ktoré prekročili VaR.
 *
 * Pre normálne rozdelenie: ES = μ − σ · φ(z_α) / (1 − α).
 */
export function parametricCVaR(
  expectedReturn: number,
  volatility: number,
  alpha = 0.95,
  years = 1,
): number {
  const mu = expectedReturn * years;
  const sigma = volatility * Math.sqrt(years);
  const z = normalInv(1 - alpha);
  const es = mu - sigma * (normalPdf(z) / (1 - alpha));
  return Math.max(0, -es);
}

/** Reálny výnos podľa Fisherovho vzťahu: (1 + r_n) / (1 + i) − 1. */
export const realReturn = (nominal: number, inflation: number): number =>
  (1 + nominal) / (1 + inflation) - 1;

/** Reálna hodnota sumy po `years` rokoch pri danej inflácii. */
export const deflate = (amount: number, inflation: number, years: number): number =>
  amount / Math.pow(1 + inflation, years);

// ───────────────────────────────────────────────────────────────────────────
// Empirické ukazovatele
// ───────────────────────────────────────────────────────────────────────────

/** Percentil zo zoradeného poľa s lineárnou interpoláciou. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

/** Výberová smerodajná odchýlka (delenie n − 1). */
export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const ss = xs.reduce((s, x) => s + (x - m) * (x - m), 0);
  return Math.sqrt(ss / (xs.length - 1));
}

/**
 * Downside deviation — smerodajná odchýlka počítaná len z výnosov pod
 * minimálnou akceptovateľnou úrovňou (MAR). Na rozdiel od volatility
 * netrestá výkyvy smerom nahor.
 */
export function downsideDeviation(xs: number[], mar = 0): number {
  if (xs.length === 0) return 0;
  const ss = xs.reduce((s, x) => s + Math.pow(Math.min(0, x - mar), 2), 0);
  return Math.sqrt(ss / xs.length);
}

/**
 * Sortinov pomer: (R_p − MAR) / DD. Vhodnejší než Sharpe tam, kde je
 * rozdelenie výnosov asymetrické — čo pri dlhodobom sporení platí.
 */
export function sortinoRatio(xs: number[], mar = 0): number {
  const dd = downsideDeviation(xs, mar);
  return dd > 0 ? (mean(xs) - mar) / dd : 0;
}

/** Výberová šikmosť rozdelenia. */
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const s = stdDev(xs);
  if (s === 0) return 0;
  const sum = xs.reduce((acc, x) => acc + Math.pow((x - m) / s, 3), 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

/** Empirický VaR na hladine `alpha` — vracia veľkosť straty ako kladné číslo. */
export function empiricalVaR(returns: number[], alpha = 0.95): number {
  const sorted = [...returns].sort((a, b) => a - b);
  return Math.max(0, -percentile(sorted, 1 - alpha));
}

/** Empirický CVaR — priemer chvosta pod kvantilom (1 − alpha). */
export function empiricalCVaR(returns: number[], alpha = 0.95): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoff = Math.max(1, Math.floor(sorted.length * (1 - alpha)));
  const tail = sorted.slice(0, cutoff);
  return Math.max(0, -mean(tail));
}

/**
 * Maximálny pokles (maximum drawdown) cesty hodnoty portfólia.
 *
 * Pozor na interpretáciu pri pravidelných vkladoch: hodnota portfólia rastie
 * aj vďaka novým vkladom, takže pokles meraný na hodnote podhodnocuje trhový
 * prepad. Funkcia preto pracuje s cestou očistenou o vklady — teda s indexom
 * zhodnotenia, nie s hodnotou účtu.
 */
export function maxDrawdown(path: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const v of path) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (v - peak) / peak;
      if (dd < worst) worst = dd;
    }
  }
  return worst;
}

/** Calmarov pomer: anualizovaný výnos delený veľkosťou maximálneho poklesu. */
export const calmarRatio = (annualReturn: number, mdd: number): number =>
  mdd < 0 ? annualReturn / Math.abs(mdd) : 0;

export interface EmpiricalMetrics {
  mean: number;
  volatility: number;
  downsideDeviation: number;
  sharpe: number;
  sortino: number;
  skewness: number;
  var95: number;
  cvar95: number;
  /** Podiel scenárov so záporným výnosom. */
  lossProbability: number;
}

/** Súhrn empirických ukazovateľov zo vzorky ročných výnosov. */
export function empiricalMetrics(returns: number[], riskFree: number): EmpiricalMetrics {
  const m = mean(returns);
  const vol = stdDev(returns);
  return {
    mean: m,
    volatility: vol,
    downsideDeviation: downsideDeviation(returns, riskFree),
    sharpe: vol > 0 ? (m - riskFree) / vol : 0,
    sortino: sortinoRatio(returns, riskFree),
    skewness: skewness(returns),
    var95: empiricalVaR(returns, 0.95),
    cvar95: empiricalCVaR(returns, 0.95),
    lossProbability: returns.length
      ? returns.filter((r) => r < 0).length / returns.length
      : 0,
  };
}
