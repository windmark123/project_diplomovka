/**
 * Odvodenie celej analýzy zo stavu aplikácie.
 *
 * Všetko je počítané z jediného zdroja pravdy, takže žiadne dve miesta
 * v rozhraní nemôžu ukázať nekonzistentné číslo. Simulácia je zámerne
 * oddelená od zvyšku: beží rádovo desiatky milisekúnd, takže sa
 * prepočítava len pri zmene vstupov, ktoré na ňu majú vplyv.
 */

import { useMemo } from 'react';

import { ASSET_CLASSES, assetClass } from '@/data/assets';
import { MACRO } from '@/data/pillars';
import {
  VARIANTS,
  allocationSlices,
  buildVariant,
  normalizeAllocation,
  portfolioStats,
  type Allocation,
  type VariantDefinition,
} from '@/engine/portfolio';
import { evaluateProfile, sustainabilityPreference } from '@/engine/profile';
import { averageAllocation } from '@/engine/projection';
import { simulate, type SimulationResult } from '@/engine/montecarlo';
import { compareRoutes, type ComparisonResult } from '@/engine/pillars';
import {
  calmarRatio,
  parametricCVaR,
  parametricVaR,
  realReturn,
  sharpeRatio,
} from '@/engine/metrics';
import { useStore, type AppState } from './store';

/** Bezriziková sadzba použitá vo výnosovo-rizikových ukazovateľoch. */
export const RISK_FREE = assetClass('cash').stats.nominalReturn;

export interface VariantAnalysis {
  definition: VariantDefinition;
  allocation: Allocation;
  stats: ReturnType<typeof portfolioStats>;
  sharpe: number;
  var95: number;
  cvar95: number;
  realReturn: number;
}

export interface Analysis {
  profile: ReturnType<typeof evaluateProfile>;
  esgPreference: number;
  /** Aktuálne zvolená alokácia (variant alebo vlastné zloženie). */
  allocation: Allocation;
  slices: ReturnType<typeof allocationSlices>;
  stats: ReturnType<typeof portfolioStats>;
  /** Priemerná alokácia za horizont vrátane vplyvu glide path. */
  averageAllocation: Allocation;
  averageStats: ReturnType<typeof portfolioStats>;
  /** Všetky tri metódy konštrukcie vyhodnotené pre daný profil. */
  variants: VariantAnalysis[];
  comparison: ComparisonResult;
  sharpe: number;
  var95: number;
  cvar95: number;
  realReturn: number;
  calmar: number;
  simulation: SimulationResult;
}

/** Alokácia zodpovedajúca stavu — buď zvolený variant, alebo vlastné váhy. */
export function resolveAllocation(state: AppState, profileId: string): Allocation {
  if (state.variant === null && state.customAllocation) {
    return normalizeAllocation(state.customAllocation);
  }
  const definition = VARIANTS.find((v) => v.id === state.variant) ?? VARIANTS[1];
  const profile = { equityBand: bandFor(profileId) } as Parameters<typeof buildVariant>[1];
  return buildVariant(definition, profile);
}

const BANDS: Record<string, [number, number]> = {
  conservative: [10, 35],
  balanced: [35, 60],
  growth: [60, 80],
  dynamic: [80, 95],
};

const bandFor = (profileId: string): [number, number] => BANDS[profileId] ?? BANDS.balanced;

export function useAnalysis(): Analysis {
  const { state } = useStore();

  const profile = useMemo(
    () => evaluateProfile({ answers: state.answers, horizon: state.horizon }),
    [state.answers, state.horizon],
  );

  const esgPreference = useMemo(() => sustainabilityPreference(state.answers), [state.answers]);

  const allocation = useMemo(
    () => resolveAllocation(state, profile.profile.id),
    [state, profile.profile.id],
  );

  const stats = useMemo(() => portfolioStats(allocation, state.funds), [allocation, state.funds]);

  const avgAllocation = useMemo(
    () => averageAllocation(allocation, state.horizon, state.glidepath),
    [allocation, state.horizon, state.glidepath],
  );

  const averageStats = useMemo(
    () => portfolioStats(avgAllocation, state.funds),
    [avgAllocation, state.funds],
  );

  const variants = useMemo<VariantAnalysis[]>(
    () =>
      VARIANTS.map((definition) => {
        const alloc = buildVariant(definition, profile.profile);
        const s = portfolioStats(alloc, state.funds);
        return {
          definition,
          allocation: alloc,
          stats: s,
          sharpe: sharpeRatio(s.expectedReturn, s.volatility, RISK_FREE),
          var95: parametricVaR(s.expectedReturn, s.volatility, 0.95, 1),
          cvar95: parametricCVaR(s.expectedReturn, s.volatility, 0.95, 1),
          realReturn: realReturn(s.expectedReturn, MACRO.inflation.value),
        };
      }),
    [profile.profile, state.funds],
  );

  const comparison = useMemo(
    () =>
      compareRoutes({
        allocation,
        funds: state.funds,
        glidepath: state.glidepath,
        monthly: state.monthly,
        years: state.horizon,
        wageBandId: state.wageBandId,
        fundRisk: state.fundRisk,
        dssId: state.dssId,
        ddsId: state.ddsId,
        useTaxRelief: state.useTaxRelief,
        riskMatched: state.riskMatched,
      }),
    [
      allocation,
      state.funds,
      state.glidepath,
      state.monthly,
      state.horizon,
      state.wageBandId,
      state.fundRisk,
      state.dssId,
      state.ddsId,
      state.useTaxRelief,
      state.riskMatched,
    ],
  );

  const simulation = useMemo(
    () =>
      simulate({
        allocation,
        funds: state.funds,
        monthly: state.monthly,
        years: state.horizon,
        glidepath: state.glidepath,
        paths: state.paths,
      }),
    [allocation, state.funds, state.monthly, state.horizon, state.glidepath, state.paths],
  );

  return useMemo(
    () => ({
      profile,
      esgPreference,
      allocation,
      slices: allocationSlices(allocation, state.funds),
      stats,
      averageAllocation: avgAllocation,
      averageStats,
      variants,
      comparison,
      sharpe: sharpeRatio(stats.expectedReturn, stats.volatility, RISK_FREE),
      var95: parametricVaR(stats.expectedReturn, stats.volatility, 0.95, 1),
      cvar95: parametricCVaR(stats.expectedReturn, stats.volatility, 0.95, 1),
      realReturn: realReturn(stats.expectedReturn, MACRO.inflation.value),
      calmar: calmarRatio(stats.expectedReturn, simulation.drawdown.median),
      simulation,
    }),
    [
      profile,
      esgPreference,
      allocation,
      state.funds,
      stats,
      avgAllocation,
      averageStats,
      variants,
      comparison,
      simulation,
    ],
  );
}

/** Zoznam tried aktív pre editor váh, zoradený od rizikových po bezpečné. */
export const EDITOR_CLASSES = ASSET_CLASSES;
