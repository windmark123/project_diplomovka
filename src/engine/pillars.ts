/**
 * Modelovanie II. a III. piliera a ich porovnanie s vlastným portfóliom.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * METODICKÝ PREDPOKLAD POROVNANIA
 * ────────────────────────────────────────────────────────────────────────────
 * Výnos dôchodkového fondu sa NEPREBERÁ z jeho historickej výkonnosti, ale
 * odvodzuje sa z rovnakých parametrov tried aktív, aké používa vlastné
 * portfólio, podľa deklarovaného podielu akciovej zložky fondu:
 *
 *   r_fond = w_akcie · r_akcie + (1 − w_akcie) · r_dlhopisy − odplata
 *
 * Bez tohto predpokladu by porovnanie miešalo dva efekty — rozdielnu
 * investičnú stratégiu a rozdielnu nákladovosť — a nedalo by sa z neho
 * usudzovať na vplyv poplatkov. Takto je rozdiel medzi cestami vysvetliteľný
 * výlučne nákladovosťou, daňovým režimom a výškou príspevku.
 *
 * Fondy s rovnakým podielom akcií tak majú pred odplatou rovnaký hrubý výnos.
 * Rozdiel, ktorý model ukazuje, je čistým rozdielom poplatkov a dane.
 */

import { assetClass } from '@/data/assets';
import {
  DDS_PROVIDERS,
  DSS_PROVIDERS,
  MACRO,
  OWN_PORTFOLIO_TAX,
  PILLAR_2,
  PILLAR_3,
  wageBand,
  type FundRisk,
  type PensionProvider,
} from '@/data/pillars';
import { deflate } from '@/engine/metrics';
import {
  accumulate,
  averageAllocation,
  projectPortfolio,
  type AccumulationResult,
  type YearPoint,
} from '@/engine/projection';
import {
  riskyShare,
  type Allocation,
  type FundSelection,
  type GlidepathConfig,
} from '@/engine/portfolio';

export type RouteId = 'own' | 'pillar2' | 'pillar3';

export interface RouteResult {
  id: RouteId;
  label: string;
  /** Konkrétny fond alebo variant, ktorý cesta reprezentuje. */
  detail: string;
  series: YearPoint[];
  /** Hodnota pred zdanením výplaty. */
  gross: number;
  /** Hodnota po zdanení výplaty — čo sporiteľovi reálne zostane. */
  net: number;
  /** Čistá hodnota v kúpnej sile času 0. */
  netReal: number;
  /** Suma, ktorú sporiteľ vložil z vlastného vrecka. */
  ownContribution: number;
  /** Suma pripísaná na účet vrátane odvodu zamestnávateľa a daňovej úľavy. */
  credited: number;
  /** Daň zaplatená pri výplate. */
  tax: number;
  /** Kumulatívne zaplatené poplatky za celý horizont. */
  fees: number;
  /** O koľko by bola hodnota vyššia pri nulových poplatkoch. */
  feeDrag: number;
  /**
   * Podiel rizikovej zložky ako desatinné číslo v intervale ⟨0; 1⟩, priemerovaný
   * za celý horizont. Pri vlastnom portfóliu zahŕňa vplyv glide path, pri
   * fondoch ide o podiel, na ktorý boli zosúladené. Všetky tri cesty preto
   * uvádzajú tú istú veličinu v tej istej jednotke a dajú sa priamo porovnať.
   */
  equityShare: number;
  /** Efektívny ročný výnos po poplatkoch. */
  netReturn: number;
  /** Vnútorná miera výnosnosti vlastných vkladov. */
  irr: number;
  /**
   * `true`, ak bol podiel akciovej zložky fondu prepísaný tak, aby zodpovedal
   * vlastnému portfóliu. Vtedy je rozdiel medzi cestami čisto rozdielom
   * nákladovosti a daňového režimu.
   */
  riskMatched: boolean;
}

export interface CompareInput {
  /** Vlastné portfólio. */
  allocation: Allocation;
  funds: FundSelection;
  glidepath?: GlidepathConfig;
  /** Mesačný vklad do vlastného portfólia a do III. piliera. */
  monthly: number;
  years: number;
  /** Identifikátor mzdového pásma pre odhad odvodu do II. piliera. */
  wageBandId: string;
  /** Rizikovosť zvoleného fondu v II. a III. pilieri. */
  fundRisk: FundRisk;
  /** Zvolená DSS. */
  dssId?: string;
  /** Zvolená DDS. */
  ddsId?: string;
  /** Uplatniť daňovú úľavu na príspevky do III. piliera. */
  useTaxRelief?: boolean;
  /**
   * Zosúladiť rizikovosť fondov s vlastným portfóliom (predvolene zapnuté).
   *
   * Pri zapnutí sa podiel akciovej zložky fondu v II. aj III. pilieri nastaví
   * na priemerný podiel rizikovej zložky vlastného portfólia za celý horizont
   * vrátane vplyvu glide path. Bez toho by sa porovnávalo 70 % akciové
   * portfólio so 100 % akciovým indexovým fondom a rozdiel by nevypovedal
   * o nákladovosti, ale o odlišne zvolenom riziku.
   *
   * Pri vypnutí sa použije deklarovaný podiel zvoleného fondu.
   */
  riskMatched?: boolean;
  inflation?: number;
  contributionGrowth?: number;
}

const providerById = (list: PensionProvider[], id?: string): PensionProvider =>
  list.find((p) => p.id === id) ?? list[0];

/**
 * Hrubý výnos fondu pred odplatou, odvodený z podielu akciovej zložky.
 * Akciová časť používa parametre rozvinutých trhov, bezpečná časť agregátne
 * dlhopisy — presne tie triedy, ktoré má k dispozícii aj vlastné portfólio.
 */
export function fundGrossReturn(equityShare: number): number {
  const equity = assetClass('dm').stats.nominalReturn;
  const bond = assetClass('bond').stats.nominalReturn;
  return equityShare * equity + (1 - equityShare) * bond;
}

/** Volatilita fondu odvodená rovnakým spôsobom, pri korelácii akcií a dlhopisov. */
export function fundVolatility(equityShare: number): number {
  const se = assetClass('dm').stats.volatility;
  const sb = assetClass('bond').stats.volatility;
  const rho = 0.1;
  const w = equityShare;
  return Math.sqrt(w * w * se * se + (1 - w) * (1 - w) * sb * sb + 2 * w * (1 - w) * rho * se * sb);
}

/** Zostaví výsledok cesty z akumulácie a daňového režimu. */
function toRoute(params: {
  id: RouteId;
  label: string;
  detail: string;
  result: AccumulationResult;
  /** Akumulácia pri nulových poplatkoch — na výpočet vplyvu nákladovosti. */
  grossResult: AccumulationResult;
  ownContribution: number;
  taxRate: number;
  /** Základ, z ktorého sa počíta zdaniteľný zisk. */
  taxBasis: number;
  equityShare: number;
  netReturn: number;
  inflation: number;
  years: number;
  riskMatched: boolean;
}): RouteResult {
  const { result, grossResult, taxRate, taxBasis, inflation, years } = params;
  const gain = Math.max(0, result.final - taxBasis);
  const tax = gain * taxRate;
  const net = result.final - tax;

  return {
    id: params.id,
    label: params.label,
    detail: params.detail,
    series: result.series,
    gross: result.final,
    net,
    netReal: deflate(net, inflation, years),
    ownContribution: params.ownContribution,
    credited: result.invested,
    tax,
    fees: grossResult.final - result.final,
    feeDrag: grossResult.final - result.final,
    equityShare: params.equityShare,
    netReturn: params.netReturn,
    irr: result.irr,
    riskMatched: params.riskMatched,
  };
}

/**
 * Projekcia II. piliera — starobné dôchodkové sporenie.
 *
 * `matchedEquity` je podiel akciovej zložky, na ktorý sa fond zosúladí
 * s vlastným portfóliom. Ak nie je zadaný, použije sa deklarovaný podiel
 * zvoleného fondu.
 */
export function projectPillar2(input: CompareInput, matchedEquity?: number): RouteResult {
  const inflation = input.inflation ?? MACRO.inflation.value;
  const growth = input.contributionGrowth ?? MACRO.wageGrowth.value;
  const dss = providerById(DSS_PROVIDERS, input.dssId);
  const fund = dss.funds.find((f) => f.key === input.fundRisk) ?? dss.funds[0];

  const useMatched = input.riskMatched !== false && matchedEquity !== undefined;
  const equity = useMatched ? matchedEquity : fund.equityShare;

  const wage = wageBand(input.wageBandId).gross;
  const contribution = wage * PILLAR_2.contributionRate.value;
  const grossReturn = fundGrossReturn(equity);
  const netReturn = grossReturn - dss.managementFee;

  const result = accumulate({
    monthly: contribution,
    years: input.years,
    contributionGrowth: growth,
    entryFee: PILLAR_2.contributionFee.value,
    rateAt: () => netReturn,
    inflation,
  });

  const grossResult = accumulate({
    monthly: contribution,
    years: input.years,
    contributionGrowth: growth,
    entryFee: 0,
    rateAt: () => grossReturn,
    inflation,
  });

  return toRoute({
    id: 'pillar2',
    label: 'II. pilier',
    detail: `${dss.company} · ${fund.name}`,
    result,
    grossResult,
    // Príspevok do II. piliera je odvodom zo mzdy, nie vkladom z čistého
    // príjmu — sporiteľ ho nemá k dispozícii na alternatívne investovanie.
    ownContribution: 0,
    taxRate: PILLAR_2.taxedOnPayout ? PILLAR_3.payoutTaxRate.value : 0,
    taxBasis: result.invested,
    equityShare: equity,
    netReturn,
    inflation,
    years: input.years,
    riskMatched: useMatched,
  });
}

/**
 * Projekcia III. piliera — doplnkové dôchodkové sporenie.
 *
 * `matchedEquity` má rovnaký význam ako pri II. pilieri.
 */
export function projectPillar3(input: CompareInput, matchedEquity?: number): RouteResult {
  const inflation = input.inflation ?? MACRO.inflation.value;
  const dds = providerById(DDS_PROVIDERS, input.ddsId);
  const fund = dds.funds.find((f) => f.key === input.fundRisk) ?? dds.funds[0];

  const useMatched = input.riskMatched !== false && matchedEquity !== undefined;
  const equity = useMatched ? matchedEquity : fund.equityShare;

  const grossReturn = fundGrossReturn(equity);
  const netReturn = grossReturn - dds.managementFee;

  // Daňová úľava: príspevky do zákonného stropu znižujú základ dane, čo
  // sporiteľovi vráti `strop × sadzba dane` ročne. Model túto úsporu pripisuje
  // späť na účet, teda predpokladá, že ju sporiteľ opäť investuje.
  const annualContribution = input.monthly * 12;
  const reliefBase = Math.min(annualContribution, PILLAR_3.taxReliefCap.value);
  const annualRelief = input.useTaxRelief === false ? 0 : reliefBase * PILLAR_3.incomeTaxRate.value;
  const effectiveMonthly = input.monthly + annualRelief / 12;

  const result = accumulate({
    monthly: effectiveMonthly,
    years: input.years,
    contributionGrowth: input.contributionGrowth ?? 0,
    rateAt: () => netReturn,
    inflation,
  });

  const grossResult = accumulate({
    monthly: effectiveMonthly,
    years: input.years,
    contributionGrowth: input.contributionGrowth ?? 0,
    rateAt: () => grossReturn,
    inflation,
  });

  const route = toRoute({
    id: 'pillar3',
    label: 'III. pilier',
    detail: `${dds.company} · ${fund.name}`,
    result,
    grossResult,
    ownContribution: input.monthly * 12 * input.years,
    taxRate: PILLAR_3.payoutTaxRate.value,
    taxBasis: result.invested,
    equityShare: equity,
    netReturn,
    inflation,
    years: input.years,
    riskMatched: useMatched,
  });

  // IRR sa počíta z vlastných vkladov, nie z pripísanej sumy — daňová úľava
  // je súčasťou výnosu sporiteľa, nie jeho nákladu.
  return route;
}

/**
 * Priemerný podiel rizikovej zložky vlastného portfólia za celý horizont.
 *
 * Nie je to počiatočná váha, ale priemer cez roky vrátane vplyvu glide path.
 * Portfólio, ktoré začne na 70 % a posledných pätnásť rokov riziko znižuje,
 * nesie v priemere výrazne menej rizika než 70 % — a práve s touto priemernou
 * hodnotou sa majú porovnávať dôchodkové fondy.
 */
export function averageRiskyShare(input: CompareInput): number {
  const avg = averageAllocation(input.allocation, input.years, input.glidepath);
  return riskyShare(avg) / 100;
}

/** Projekcia vlastného portfólia z ETF. */
export function projectOwn(input: CompareInput): RouteResult {
  const inflation = input.inflation ?? MACRO.inflation.value;

  const result = projectPortfolio({
    allocation: input.allocation,
    funds: input.funds,
    monthly: input.monthly,
    years: input.years,
    glidepath: input.glidepath,
    contributionGrowth: input.contributionGrowth ?? 0,
    inflation,
  });

  // Rovnaká alokácia bez TER — rozdiel ukazuje vplyv nákladovosti fondov.
  const grossResult = accumulate({
    monthly: input.monthly,
    years: input.years,
    contributionGrowth: input.contributionGrowth ?? 0,
    rateAt: (y) => {
      const share = result.series[Math.min(y, result.series.length - 1)];
      return share.rate + result.initialStats.ter;
    },
    inflation,
  });

  // Časový test podľa § 9 ods. 1 písm. k) je pri dôchodkovom horizonte
  // splnený pre celý objem, takže zisk z predaja je oslobodený od dane.
  const timeTestMet = input.years > OWN_PORTFOLIO_TAX.timeTestYears.value;
  const taxRate = timeTestMet ? 0 : OWN_PORTFOLIO_TAX.capitalGainsRate.value;

  return toRoute({
    id: 'own',
    label: 'Vlastné portfólio',
    detail: `${Math.round(result.initialStats.risky)} % riziková zložka · TER ${(result.initialStats.ter * 100).toFixed(2)} %`,
    result,
    grossResult,
    ownContribution: result.invested,
    taxRate,
    taxBasis: result.invested,
    // Priemer za horizont, nie počiatočná váha — to je veličina, na ktorú sa
    // zosúlaďujú fondy v oboch pilieroch.
    equityShare: averageRiskyShare(input),
    netReturn: result.initialStats.expectedReturn,
    inflation,
    years: input.years,
    // Vlastné portfólio je referenciou porovnania, nie zosúladenou stranou.
    riskMatched: false,
  });
}

export interface ComparisonResult {
  own: RouteResult;
  pillar2: RouteResult;
  pillar3: RouteResult;
  routes: RouteResult[];
  /** Rozdiel čistej hodnoty vlastného portfólia oproti III. pilieru. */
  ownVsPillar3: number;
  /** Rozdiel čistej hodnoty vlastného portfólia oproti II. pilieru. */
  ownVsPillar2: number;
  /**
   * Rozdiel pri rovnakom mesačnom vklade — II. pilier má iný objem príspevku,
   * preto sa porovnáva aj normalizovane na 100 € mesačne.
   */
  per100: { own: number; pillar2: number; pillar3: number };
  /** Podiel akciovej zložky, na ktorý boli fondy zosúladené (0–1). */
  matchedEquity: number;
  /** `true`, ak porovnanie prebehlo pri zosúladenom riziku. */
  riskMatched: boolean;
}

export function compareRoutes(input: CompareInput): ComparisonResult {
  const own = projectOwn(input);
  const matchedEquity = averageRiskyShare(input);
  const pillar2 = projectPillar2(input, matchedEquity);
  const pillar3 = projectPillar3(input, matchedEquity);

  const normalize = (route: RouteResult): number => {
    const monthlyCredited = route.credited / (input.years * 12);
    return monthlyCredited > 0 ? (route.net / monthlyCredited) * 100 : 0;
  };

  return {
    own,
    pillar2,
    pillar3,
    routes: [own, pillar2, pillar3],
    ownVsPillar3: own.net - pillar3.net,
    ownVsPillar2: own.net - pillar2.net,
    per100: {
      own: normalize(own),
      pillar2: normalize(pillar2),
      pillar3: normalize(pillar3),
    },
    matchedEquity,
    riskMatched: input.riskMatched !== false,
  };
}

/** Citlivosť konečnej hodnoty na nákladovosť — vstup do grafu vplyvu poplatkov. */
export function feeSensitivity(params: {
  monthly: number;
  years: number;
  grossReturn: number;
  feeLevels: number[];
  inflation?: number;
}): Array<{ fee: number; final: number }> {
  return params.feeLevels.map((fee) => ({
    fee,
    final: accumulate({
      monthly: params.monthly,
      years: params.years,
      rateAt: () => params.grossReturn - fee,
      inflation: params.inflation,
    }).final,
  }));
}
