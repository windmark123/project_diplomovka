/**
 * Triedy aktív, investičné nástroje a ich modelové parametre.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PÔVOD ÚDAJOV (nutné overiť pred odovzdaním práce)
 * ────────────────────────────────────────────────────────────────────────────
 * Hodnoty `stats` sú dlhodobé anualizované parametre v EUR, zodpovedajúce
 * bežne uvádzaným charakteristikám príslušných indexov za obdobie 1999–2024.
 * Slúžia ako VÝCHODISKOVÉ parametre modelu. Autor práce ich má nahradiť
 * hodnotami z vlastného dátového zdroja (MSCI index factsheets, ICE/Bloomberg
 * bond indices, LBMA pre zlato) a doplniť dátum stiahnutia do `DATA_VINTAGE`.
 *
 * Celý model číta parametre výhradne odtiaľto — výmena čísel je zmena
 * jedného súboru a nevyžaduje zásah do výpočtovej logiky.
 *
 * `ter` a `isin` zodpovedajú KID dokumentom fondov; pri finalizácii práce
 * treba obe polia overiť voči aktuálnemu KID, pretože sa v čase menia.
 */

export const DATA_VINTAGE = {
  /** Obdobie, z ktorého sú odvodené parametre `stats`. */
  period: '1999–2024',
  /** Dátum, ku ktorému boli parametre naposledy overené. */
  verifiedOn: '2026-09-22',
  /** Mena, v ktorej sú vyjadrené všetky výnosy a volatility. */
  currency: 'EUR',
  /** Nastav na `true` až po overení voči primárnemu zdroju. */
  verifiedAgainstPrimarySource: false,
} as const;

export type AssetKind = 'equity' | 'real' | 'bond' | 'cash';

export type AssetClassId = 'dm' | 'em' | 'sc' | 'reit' | 'gold' | 'bond' | 'cash';

export interface Fund {
  /** Burzový ticker (XETRA / LSE). */
  ticker: string;
  isin: string;
  name: string;
  provider: string;
  /** Celková nákladovosť fondu p. a. (0,0020 = 0,20 %). */
  ter: number;
  replication: 'fyzická' | 'fyzická (sampling)' | 'swap' | 'fyzická (ETC)';
  distribution: 'akumulačný' | 'distribučný';
  domicile: string;
  /** Index, ktorý fond sleduje. */
  benchmark: string;
}

export interface AssetClassStats {
  /** Nominálny anualizovaný výnos p. a. pred poplatkom fondu. */
  nominalReturn: number;
  /** Anualizovaná smerodajná odchýlka ročných výnosov. */
  volatility: number;
  /**
   * Historický maximálny pokles indexu (peak-to-trough) v sledovanom období.
   * Používa sa len ako kontext pre používateľa, nie ako vstup do výpočtu.
   */
  historicalMaxDrawdown: number;
}

export interface AssetClass {
  id: AssetClassId;
  name: string;
  short: string;
  kind: AssetKind;
  /** CSS premenná dizajnového systému použitá v grafoch. */
  color: string;
  description: string;
  stats: AssetClassStats;
  funds: Fund[];
}

export const ASSET_CLASSES: AssetClass[] = [
  {
    id: 'dm',
    name: 'Akcie rozvinutých trhov',
    short: 'Rozvinuté akcie',
    kind: 'equity',
    color: 'var(--ink-1)',
    description:
      'Veľké a stredné spoločnosti z 23 rozvinutých ekonomík. Nosná rastová zložka portfólia s najdlhšou dostupnou históriou.',
    stats: { nominalReturn: 0.085, volatility: 0.152, historicalMaxDrawdown: -0.54 },
    funds: [
      {
        ticker: 'IWDA',
        isin: 'IE00B4L5Y983',
        name: 'iShares Core MSCI World UCITS ETF',
        provider: 'BlackRock',
        ter: 0.002,
        replication: 'fyzická (sampling)',
        distribution: 'akumulačný',
        domicile: 'Írsko',
        benchmark: 'MSCI World',
      },
      {
        ticker: 'VWCE',
        isin: 'IE00BK5BQT80',
        name: 'Vanguard FTSE All-World UCITS ETF',
        provider: 'Vanguard',
        ter: 0.0022,
        replication: 'fyzická (sampling)',
        distribution: 'akumulačný',
        domicile: 'Írsko',
        benchmark: 'FTSE All-World',
      },
      {
        ticker: 'CSPX',
        isin: 'IE00B5BMR087',
        name: 'iShares Core S&P 500 UCITS ETF',
        provider: 'BlackRock',
        ter: 0.0007,
        replication: 'fyzická',
        distribution: 'akumulačný',
        domicile: 'Írsko',
        benchmark: 'S&P 500',
      },
    ],
  },
  {
    id: 'em',
    name: 'Akcie rozvíjajúcich sa trhov',
    short: 'Rozvíjajúce sa trhy',
    kind: 'equity',
    color: 'var(--ink-3)',
    description:
      'Spoločnosti z rozvíjajúcich sa ekonomík. Vyšší očakávaný výnos aj vyššia volatilita a politické riziko než rozvinuté trhy.',
    stats: { nominalReturn: 0.07, volatility: 0.202, historicalMaxDrawdown: -0.61 },
    funds: [
      {
        ticker: 'EIMI',
        isin: 'IE00BKM4GZ66',
        name: 'iShares Core MSCI EM IMI UCITS ETF',
        provider: 'BlackRock',
        ter: 0.0018,
        replication: 'fyzická (sampling)',
        distribution: 'akumulačný',
        domicile: 'Írsko',
        benchmark: 'MSCI Emerging Markets IMI',
      },
    ],
  },
  {
    id: 'sc',
    name: 'Akcie malých spoločností',
    short: 'Malé firmy',
    kind: 'equity',
    color: 'var(--ink-4)',
    description:
      'Malé spoločnosti rozvinutých trhov. Historicky prémia za veľkosť, vykúpená vyššou volatilitou a vyššou nákladovosťou fondov.',
    stats: { nominalReturn: 0.09, volatility: 0.181, historicalMaxDrawdown: -0.58 },
    funds: [
      {
        ticker: 'WSML',
        isin: 'IE00BF4RFH31',
        name: 'iShares MSCI World Small Cap UCITS ETF',
        provider: 'BlackRock',
        ter: 0.0035,
        replication: 'fyzická (sampling)',
        distribution: 'akumulačný',
        domicile: 'Írsko',
        benchmark: 'MSCI World Small Cap',
      },
    ],
  },
  {
    id: 'reit',
    name: 'Nehnuteľnosti (REIT)',
    short: 'Nehnuteľnosti',
    kind: 'real',
    color: 'var(--signal-1)',
    description:
      'Kótované realitné spoločnosti rozvinutých trhov. Čiastočná ochrana pred infláciou, ale v krízach koreluje s akciami.',
    stats: { nominalReturn: 0.068, volatility: 0.191, historicalMaxDrawdown: -0.68 },
    funds: [
      {
        ticker: 'IWDP',
        isin: 'IE00B1FZS350',
        name: 'iShares Developed Markets Property Yield UCITS ETF',
        provider: 'BlackRock',
        ter: 0.0059,
        replication: 'fyzická (sampling)',
        distribution: 'distribučný',
        domicile: 'Írsko',
        benchmark: 'FTSE EPRA/NAREIT Developed Dividend+',
      },
    ],
  },
  {
    id: 'gold',
    name: 'Zlato',
    short: 'Zlato',
    kind: 'real',
    color: 'var(--signal-3)',
    description:
      'Fyzicky kryté zlato. Negeneruje výnos ani dividendu; v portfóliu plní úlohu diverzifikátora s nízkou koreláciou k akciám.',
    stats: { nominalReturn: 0.062, volatility: 0.154, historicalMaxDrawdown: -0.45 },
    funds: [
      {
        ticker: 'SGLN',
        isin: 'IE00B4ND3602',
        name: 'iShares Physical Gold ETC',
        provider: 'BlackRock',
        ter: 0.0012,
        replication: 'fyzická (ETC)',
        distribution: 'akumulačný',
        domicile: 'Írsko',
        benchmark: 'LBMA Gold Price',
      },
    ],
  },
  {
    id: 'bond',
    name: 'Dlhopisy EUR',
    short: 'Dlhopisy',
    kind: 'bond',
    color: 'var(--route-2p)',
    description:
      'Investičné štátne a podnikové dlhopisy v eurách. Stabilizačná zložka, ktorá tlmí poklesy akciovej časti portfólia.',
    stats: { nominalReturn: 0.032, volatility: 0.047, historicalMaxDrawdown: -0.19 },
    funds: [
      {
        ticker: 'IEAG',
        isin: 'IE00B3DKXQ41',
        name: 'iShares Core € Aggregate Bond UCITS ETF',
        provider: 'BlackRock',
        ter: 0.0016,
        replication: 'fyzická (sampling)',
        distribution: 'akumulačný',
        domicile: 'Írsko',
        benchmark: 'Bloomberg Euro Aggregate Bond',
      },
      {
        ticker: 'VGEA',
        isin: 'IE00BH04GL39',
        name: 'Vanguard EUR Eurozone Government Bond UCITS ETF',
        provider: 'Vanguard',
        ter: 0.0007,
        replication: 'fyzická (sampling)',
        distribution: 'akumulačný',
        domicile: 'Írsko',
        benchmark: 'Bloomberg Euro Government Float Adjusted',
      },
    ],
  },
  {
    id: 'cash',
    name: 'Peňažný trh',
    short: 'Hotovosť',
    kind: 'cash',
    color: 'var(--paper-4)',
    description:
      'Nástroje peňažného trhu naviazané na sadzbu €STR. Takmer nulová volatilita, výnos však dlhodobo sotva pokrýva infláciu.',
    stats: { nominalReturn: 0.021, volatility: 0.006, historicalMaxDrawdown: -0.01 },
    funds: [
      {
        ticker: 'XEON',
        isin: 'LU0290358497',
        name: 'Xtrackers II EUR Overnight Rate Swap UCITS ETF',
        provider: 'DWS',
        ter: 0.001,
        replication: 'swap',
        distribution: 'akumulačný',
        domicile: 'Luxembursko',
        benchmark: 'Euro Short-Term Rate (€STR)',
      },
    ],
  },
];

export const ASSET_CLASS_IDS = ASSET_CLASSES.map((c) => c.id);

export const assetClass = (id: AssetClassId): AssetClass => {
  const found = ASSET_CLASSES.find((c) => c.id === id);
  if (!found) throw new Error(`Neznáma trieda aktív: ${id}`);
  return found;
};

export const findFund = (classId: AssetClassId, ticker: string): Fund => {
  const cls = assetClass(classId);
  return cls.funds.find((f) => f.ticker === ticker) ?? cls.funds[0];
};

/** Predvolený nástroj pre každú triedu aktív (najnižší TER v rámci triedy). */
export const DEFAULT_FUNDS: Record<AssetClassId, string> = ASSET_CLASSES.reduce(
  (acc, cls) => {
    acc[cls.id] = [...cls.funds].sort((a, b) => a.ter - b.ter)[0].ticker;
    return acc;
  },
  {} as Record<AssetClassId, string>,
);

/**
 * Korelačná matica ročných výnosov tried aktív.
 *
 * Symetrická, s jednotkami na diagonále. Používa sa na výpočet volatility
 * portfólia (σ² = wᵀΣw) a na generovanie korelovaných scenárov v Monte Carlo
 * simulácii cez Choleského rozklad. Hodnoty zodpovedajú dlhodobým koreláciám
 * uvádzaným v literatúre; rovnako ako `stats` ich treba pred odovzdaním
 * overiť voči vlastnému dátovému zdroju.
 */
export const CORRELATION: Record<AssetClassId, Record<AssetClassId, number>> = {
  dm:   { dm: 1.0,  em: 0.82, sc: 0.90, reit: 0.72, gold: 0.05, bond: 0.10, cash: 0.0 },
  em:   { dm: 0.82, em: 1.0,  sc: 0.76, reit: 0.63, gold: 0.18, bond: 0.12, cash: 0.0 },
  sc:   { dm: 0.90, em: 0.76, sc: 1.0,  reit: 0.74, gold: 0.02, bond: 0.05, cash: 0.0 },
  reit: { dm: 0.72, em: 0.63, sc: 0.74, reit: 1.0,  gold: 0.12, bond: 0.28, cash: 0.0 },
  gold: { dm: 0.05, em: 0.18, sc: 0.02, reit: 0.12, gold: 1.0,  bond: 0.22, cash: 0.0 },
  bond: { dm: 0.10, em: 0.12, sc: 0.05, reit: 0.28, gold: 0.22, bond: 1.0,  cash: 0.15 },
  cash: { dm: 0.0,  em: 0.0,  sc: 0.0,  reit: 0.0,  gold: 0.0,  bond: 0.15, cash: 1.0 },
};
