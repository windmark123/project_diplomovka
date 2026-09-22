/**
 * Konštrukcia portfólia a jeho štatistické charakteristiky.
 *
 * Práca porovnáva tri metódy konštrukcie, ktoré sa líšia mierou diverzifikácie
 * a nákladovosťou. Každá z nich sa aplikuje v rámci pásma akciovej zložky
 * prislúchajúceho rizikovému profilu, takže všetky tri varianty sú pre daného
 * sporiteľa rizikovo prípustné a dajú sa porovnávať medzi sebou.
 *
 * Volatilita portfólia sa počíta z kovariančnej matice tried aktív, nie ako
 * vážený priemer volatilít — práve krížové členy zachytávajú efekt
 * diverzifikácie, ktorý je jedným z argumentov práce.
 */

import {
  ASSET_CLASSES,
  ASSET_CLASS_IDS,
  CORRELATION,
  DEFAULT_FUNDS,
  assetClass,
  findFund,
  type AssetClassId,
} from '@/data/assets';
import { bandMidpoint, type Profile } from '@/engine/profile';

/** Váhy tried aktív v percentách. Súčet je vždy 100. */
export type Allocation = Record<AssetClassId, number>;

/** Výber konkrétneho fondu pre každú triedu aktív. */
export type FundSelection = Record<AssetClassId, string>;

export const emptyAllocation = (): Allocation =>
  ASSET_CLASS_IDS.reduce((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {} as Allocation);

export const defaultFundSelection = (): FundSelection => ({ ...DEFAULT_FUNDS });

/** Súčet váh alokácie. */
export const allocationTotal = (a: Allocation): number =>
  ASSET_CLASS_IDS.reduce((s, id) => s + (a[id] || 0), 0);

/** Prenormuje váhy tak, aby ich súčet bol presne 100 %. */
export function normalizeAllocation(a: Allocation): Allocation {
  const total = allocationTotal(a);
  if (total <= 0) return emptyAllocation();
  const out = emptyAllocation();
  for (const id of ASSET_CLASS_IDS) out[id] = ((a[id] || 0) / total) * 100;
  return out;
}

/** Podiel akciovej a realitnej zložky, teda rizikovej časti portfólia. */
export function riskyShare(a: Allocation): number {
  return ASSET_CLASS_IDS.filter((id) => {
    const kind = assetClass(id).kind;
    return kind === 'equity' || kind === 'real';
  }).reduce((s, id) => s + (a[id] || 0), 0);
}

/** Podiel samotných akcií (bez nehnuteľností a zlata). */
export function equityShare(a: Allocation): number {
  return ASSET_CLASS_IDS.filter((id) => assetClass(id).kind === 'equity').reduce(
    (s, id) => s + (a[id] || 0),
    0,
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Metódy konštrukcie
// ───────────────────────────────────────────────────────────────────────────

export type VariantId = 'core' | 'market' | 'diversified';

export interface VariantDefinition {
  id: VariantId;
  name: string;
  method: string;
  /** Kde v pásme profilu leží riziková zložka tohto variantu (0 = spodok, 1 = vrch). */
  bandPosition: number;
  description: string;
  /** Rozdelenie rizikovej časti medzi triedy aktív. Súčet je 1. */
  riskySplit: Partial<Record<AssetClassId, number>>;
  /** Rozdelenie bezpečnej časti. Súčet je 1. */
  safeSplit: Partial<Record<AssetClassId, number>>;
}

export const VARIANTS: VariantDefinition[] = [
  {
    id: 'core',
    name: 'Jadrové portfólio',
    method: 'Jadro – satelit, minimalistická forma',
    bandPosition: 0.25,
    description:
      'Dva nástroje: globálny akciový index a agregátny dlhopisový fond. Najnižšia nákladovosť a najjednoduchšia správa — sporiteľ rieši jedno rozhodnutie ročne. Cenou je, že portfólio nevyužíva diverzifikačný efekt ďalších tried aktív.',
    riskySplit: { dm: 1.0 },
    safeSplit: { bond: 1.0 },
  },
  {
    id: 'market',
    name: 'Trhovo vážené portfólio',
    method: 'Replikácia globálneho trhového portfólia',
    bandPosition: 0.5,
    description:
      'Riziková zložka kopíruje trhovú kapitalizáciu svetových akciových trhov — rozvinuté trhy tvoria jej prevažnú časť, rozvíjajúce sa trhy a malé firmy dopĺňajú zvyšok. Bezpečná zložka drží malú hotovostnú rezervu na rebalansovanie.',
    riskySplit: { dm: 0.78, em: 0.12, sc: 0.1 },
    safeSplit: { bond: 0.85, cash: 0.15 },
  },
  {
    id: 'diversified',
    name: 'Diverzifikované portfólio',
    method: 'Rozšírenie o reálne aktíva',
    bandPosition: 0.8,
    description:
      'K akciovej zložke pridáva nehnuteľnosti a zlato. Obe triedy majú k akciám nižšiu koreláciu, takže pri rovnakej rizikovej váhe znižujú volatilitu celku. Za diverzifikáciu sa platí vyššou nákladovosťou realitného fondu.',
    riskySplit: { dm: 0.6, em: 0.12, sc: 0.08, reit: 0.1, gold: 0.1 },
    safeSplit: { bond: 0.75, cash: 0.25 },
  },
];

export const variantById = (id: VariantId): VariantDefinition => {
  const found = VARIANTS.find((v) => v.id === id);
  if (!found) throw new Error(`Neznámy variant: ${id}`);
  return found;
};

/**
 * Zostaví alokáciu variantu pre daný profil.
 *
 * Riziková váha sa určí ako bod v pásme profilu podľa `bandPosition`, takže
 * žiadny variant nevybočí z rizikového pásma, ktoré dotazník sporiteľovi určil.
 */
export function buildVariant(variant: VariantDefinition, profile: Profile): Allocation {
  const [lo, hi] = profile.equityBand;
  const risky = lo + (hi - lo) * variant.bandPosition;
  const safe = 100 - risky;

  const out = emptyAllocation();
  for (const [id, share] of Object.entries(variant.riskySplit)) {
    out[id as AssetClassId] += risky * (share ?? 0);
  }
  for (const [id, share] of Object.entries(variant.safeSplit)) {
    out[id as AssetClassId] += safe * (share ?? 0);
  }
  return normalizeAllocation(out);
}

/**
 * Alokácia odvodená len z požadovanej rizikovej váhy, použitá keď si
 * používateľ posúva akciovú zložku ručne. Vychádza z trhovo váženej metódy.
 */
export function allocationForRiskyShare(risky: number): Allocation {
  const clamped = Math.min(100, Math.max(0, risky));
  return buildVariant(VARIANTS[1], {
    ...({} as Profile),
    equityBand: [clamped, clamped],
  } as Profile);
}

// ───────────────────────────────────────────────────────────────────────────
// Štatistické charakteristiky portfólia
// ───────────────────────────────────────────────────────────────────────────

export interface PortfolioStats {
  /** Očakávaný nominálny výnos p. a. po odpočítaní TER. */
  expectedReturn: number;
  /** Očakávaný výnos pred poplatkami. */
  grossReturn: number;
  /** Vážená nákladovosť portfólia p. a. */
  ter: number;
  /** Anualizovaná volatilita počítaná z kovariančnej matice. */
  volatility: number;
  /** Podiel akciovej zložky v percentách. */
  equity: number;
  /** Podiel rizikovej zložky (akcie + reálne aktíva) v percentách. */
  risky: number;
  /**
   * Súčet vážených volatilít, teda volatilita, ktorú by portfólio malo pri
   * dokonalej korelácii. Rozdiel voči `volatility` je efekt diverzifikácie.
   */
  undiversifiedVolatility: number;
}

/** Kovariancia dvoch tried aktív: σ_ij = ρ_ij · σ_i · σ_j. */
const covariance = (a: AssetClassId, b: AssetClassId): number =>
  CORRELATION[a][b] * assetClass(a).stats.volatility * assetClass(b).stats.volatility;

export function portfolioStats(alloc: Allocation, funds: FundSelection): PortfolioStats {
  const w = normalizeAllocation(alloc);

  let grossReturn = 0;
  let ter = 0;
  let undiversified = 0;

  for (const id of ASSET_CLASS_IDS) {
    const weight = w[id] / 100;
    if (weight <= 0) continue;
    const cls = assetClass(id);
    const fund = findFund(id, funds[id]);
    grossReturn += weight * cls.stats.nominalReturn;
    ter += weight * fund.ter;
    undiversified += weight * cls.stats.volatility;
  }

  // σ²_p = Σ_i Σ_j w_i w_j ρ_ij σ_i σ_j
  let variance = 0;
  for (const i of ASSET_CLASS_IDS) {
    const wi = w[i] / 100;
    if (wi <= 0) continue;
    for (const j of ASSET_CLASS_IDS) {
      const wj = w[j] / 100;
      if (wj <= 0) continue;
      variance += wi * wj * covariance(i, j);
    }
  }

  return {
    grossReturn,
    ter,
    expectedReturn: grossReturn - ter,
    volatility: Math.sqrt(Math.max(0, variance)),
    equity: equityShare(w),
    risky: riskyShare(w),
    undiversifiedVolatility: undiversified,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Glide path
// ───────────────────────────────────────────────────────────────────────────

export interface GlidepathConfig {
  enabled: boolean;
  /** Počet rokov pred koncom horizontu, počas ktorých sa riziko znižuje. */
  years: number;
  /** Podiel pôvodnej rizikovej váhy, ktorý zostane na konci horizontu. */
  endFactor: number;
}

export const DEFAULT_GLIDEPATH: GlidepathConfig = {
  enabled: true,
  years: 15,
  endFactor: 0.35,
};

/**
 * Riziková váha v danom roku sporenia.
 *
 * Mimo obdobia glide path zostáva na pôvodnej úrovni. V poslednom úseku klesá
 * lineárne na `endFactor` násobok pôvodnej váhy. Zmyslom je znížiť následok
 * poklesu trhu tesne pred dôchodkom, keď už nezostáva čas na zotavenie —
 * ide o rovnaký princíp, aký používajú target-date fondy.
 */
export function riskyWeightAtYear(
  initialRisky: number,
  yearsLeft: number,
  cfg: GlidepathConfig = DEFAULT_GLIDEPATH,
): number {
  if (!cfg.enabled || yearsLeft >= cfg.years) return initialRisky;
  const progress = Math.max(0, yearsLeft) / cfg.years;
  return initialRisky * (cfg.endFactor + (1 - cfg.endFactor) * progress);
}

/**
 * Alokácia prepočítaná na daný rok horizontu podľa glide path. Pomer medzi
 * triedami vnútri rizikovej a bezpečnej časti zostáva zachovaný — mení sa
 * len deliaca čiara medzi nimi.
 */
export function allocationAtYear(
  base: Allocation,
  yearsLeft: number,
  cfg: GlidepathConfig = DEFAULT_GLIDEPATH,
): Allocation {
  const w = normalizeAllocation(base);
  const risky0 = riskyShare(w);
  if (risky0 <= 0 || risky0 >= 100) return w;

  const target = riskyWeightAtYear(risky0, yearsLeft, cfg);
  const riskyScale = target / risky0;
  const safeScale = (100 - target) / (100 - risky0);

  const out = emptyAllocation();
  for (const id of ASSET_CLASS_IDS) {
    const kind = assetClass(id).kind;
    const isRisky = kind === 'equity' || kind === 'real';
    out[id] = w[id] * (isRisky ? riskyScale : safeScale);
  }
  return out;
}

/** Vážená nákladovosť alokácie — používa sa v porovnávacích tabuľkách. */
export function weightedTer(alloc: Allocation, funds: FundSelection): number {
  const w = normalizeAllocation(alloc);
  return ASSET_CLASS_IDS.reduce((s, id) => s + (w[id] / 100) * findFund(id, funds[id]).ter, 0);
}

/** Zoznam tried s nenulovou váhou, zoradený zostupne — vstup do grafov. */
export function allocationSlices(alloc: Allocation, funds: FundSelection) {
  const w = normalizeAllocation(alloc);
  return ASSET_CLASSES.filter((c) => w[c.id] > 0.05)
    .map((c) => ({
      id: c.id,
      label: c.name,
      short: c.short,
      value: w[c.id],
      color: c.color,
      fund: findFund(c.id, funds[c.id]),
    }))
    .sort((a, b) => b.value - a.value);
}

/** Predvolená alokácia pre profil — trhovo vážený variant v strede pásma. */
export function defaultAllocation(profile: Profile): Allocation {
  const midpoint = bandMidpoint(profile);
  return buildVariant({ ...VARIANTS[1], bandPosition: 0.5 }, {
    ...profile,
    equityBand: [midpoint, midpoint],
  });
}
