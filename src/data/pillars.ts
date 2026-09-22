/**
 * Parametre dôchodkového systému SR a makroekonomické predpoklady modelu.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PRÁVNY RÁMEC — nutné overiť voči aktuálnemu zneniu predpisov
 * ────────────────────────────────────────────────────────────────────────────
 * Sadzby a limity nižšie sú parametre modelu, nie právne stanovisko. Legislatíva
 * druhého aj tretieho piliera sa v poslednej dekáde menila opakovane, preto je
 * každá hodnota označená odkazom na predpis a príznakom `verify`. Autor práce
 * má hodnoty overiť ku dňu odovzdania a dátum zapísať do `LEGAL_VINTAGE`.
 *
 * Všetky sadzby sú zároveň editovateľné v používateľskom rozhraní nástroja,
 * takže model je použiteľný aj po zmene legislatívy bez zásahu do kódu.
 */

export const LEGAL_VINTAGE = {
  verifiedOn: '2026-09-22',
  /** Nastav na `true` až po overení voči Zbierke zákonov. */
  verifiedAgainstZbierka: false,
} as const;

export interface LegalParam<T> {
  value: T;
  label: string;
  /** Predpis, z ktorého hodnota vychádza. */
  source: string;
  /** `true`, ak sa hodnota mení často a treba ju overiť pred odovzdaním. */
  verify: boolean;
}

/** Makroekonomické predpoklady spoločné pre všetky tri porovnávané cesty. */
export const MACRO = {
  /** Dlhodobý cieľ inflácie ECB; použitý na prepočet na reálnu hodnotu. */
  inflation: {
    value: 0.02,
    label: 'Dlhodobá inflácia',
    source: 'Cieľ ECB pre HICP v strednodobom horizonte',
    verify: false,
  } as LegalParam<number>,
  /** Predpokladaný reálny rast hrubej mzdy (rastie s ním aj odvod do II. piliera). */
  wageGrowth: {
    value: 0.02,
    label: 'Reálny rast mzdy',
    source: 'Dlhodobý predpoklad; upraviteľné v nástroji',
    verify: false,
  } as LegalParam<number>,
};

/** Parametre II. piliera — starobné dôchodkové sporenie. */
export const PILLAR_2 = {
  contributionRate: {
    value: 0.04,
    label: 'Sadzba príspevku z hrubej mzdy',
    source: 'Zákon č. 43/2004 Z. z. o starobnom dôchodkovom sporení, § 22',
    verify: true,
  } as LegalParam<number>,
  /** Odplata za správu dôchodkového fondu p. a. (zákonný strop). */
  managementFeeCap: {
    value: 0.0045,
    label: 'Strop odplaty za správu p. a.',
    source: 'Zákon č. 43/2004 Z. z., § 63 a príloha č. 1',
    verify: true,
  } as LegalParam<number>,
  /** Odplata za vedenie osobného dôchodkového účtu (% z príspevku). */
  contributionFee: {
    value: 0.01,
    label: 'Odplata za vedenie účtu (% z príspevku)',
    source: 'Zákon č. 43/2004 Z. z., § 63',
    verify: true,
  } as LegalParam<number>,
  /**
   * Výplatná fáza druhého piliera je zdaňovaná odlišne od bežného investičného
   * príjmu; model s ňou pracuje ako s nezdanenou akumuláciou a upozorňuje,
   * že spôsob výplaty (doživotný dôchodok vs. programový výber) je mimo rozsahu.
   */
  taxedOnPayout: false,
} as const;

/** Parametre III. piliera — doplnkové dôchodkové sporenie. */
export const PILLAR_3 = {
  /** Ročný strop príspevkov odpočítateľných od základu dane. */
  taxReliefCap: {
    value: 180,
    label: 'Ročný strop daňovej úľavy',
    source: 'Zákon č. 595/2003 Z. z. o dani z príjmov, § 11 ods. 8',
    verify: true,
  } as LegalParam<number>,
  /** Sadzba dane z príjmu fyzických osôb (prvé pásmo). */
  incomeTaxRate: {
    value: 0.19,
    label: 'Sadzba dane z príjmu FO',
    source: 'Zákon č. 595/2003 Z. z., § 15',
    verify: true,
  } as LegalParam<number>,
  /** Zrážková daň z výnosu pri výplate z DDS. */
  payoutTaxRate: {
    value: 0.19,
    label: 'Zrážková daň z výnosu pri výplate',
    source: 'Zákon č. 595/2003 Z. z., § 43',
    verify: true,
  } as LegalParam<number>,
} as const;

/** Parametre zdanenia vlastného portfólia ETF. */
export const OWN_PORTFOLIO_TAX = {
  /**
   * Príjem z predaja cenných papierov prijatých na obchodovanie na regulovanom
   * trhu je oslobodený od dane, ak doba medzi nadobudnutím a predajom presiahne
   * jeden rok. Pri sporení na dôchodok s horizontom v desiatkach rokov je táto
   * podmienka splnená pre celý objem.
   */
  timeTestYears: {
    value: 1,
    label: 'Časový test pre oslobodenie',
    source: 'Zákon č. 595/2003 Z. z., § 9 ods. 1 písm. k)',
    verify: true,
  } as LegalParam<number>,
  /** Sadzba, ktorá by sa uplatnila, ak časový test nie je splnený. */
  capitalGainsRate: {
    value: 0.19,
    label: 'Daň zo zisku pri nesplnení časového testu',
    source: 'Zákon č. 595/2003 Z. z., § 15',
    verify: true,
  } as LegalParam<number>,
  /**
   * Akumulačné ETF nevyplácajú dividendu, takže pri držbe nevzniká priebežný
   * zdaniteľný príjem ani vymeriavací základ na zdravotné odvody.
   */
  accumulatingAvoidsDividendTax: true,
} as const;

export type FundRisk = 'index' | 'growth' | 'conservative';

export interface PensionFund {
  key: FundRisk;
  name: string;
  /** Podiel akciovej zložky fondu (slúži na rizikovo konzistentné porovnanie). */
  equityShare: number;
}

export interface PensionProvider {
  id: string;
  company: string;
  /** Odplata za správu p. a. podľa výkazov spoločnosti. */
  managementFee: number;
  funds: PensionFund[];
}

/**
 * Správcovské spoločnosti II. piliera (DSS).
 *
 * Názvy fondov a odplaty treba overiť voči aktuálnym štatútom fondov a
 * mesačným výkazom zverejneným na stránke NBS.
 */
export const DSS_PROVIDERS: PensionProvider[] = [
  {
    id: 'allianz',
    company: 'Allianz – Slovenská DSS',
    managementFee: 0.004,
    funds: [
      { key: 'index', name: 'Indexový negarantovaný d. f.', equityShare: 1.0 },
      { key: 'growth', name: 'Akciový negarantovaný d. f.', equityShare: 0.8 },
      { key: 'conservative', name: 'Dlhopisový garantovaný d. f.', equityShare: 0.0 },
    ],
  },
  {
    id: 'tatra',
    company: 'DSS Tatra banky',
    managementFee: 0.0042,
    funds: [
      { key: 'index', name: 'Indexový negarantovaný d. f.', equityShare: 1.0 },
      { key: 'growth', name: 'Akciový negarantovaný d. f.', equityShare: 0.8 },
      { key: 'conservative', name: 'Dlhopisový garantovaný d. f.', equityShare: 0.0 },
    ],
  },
  {
    id: 'vub',
    company: 'VÚB Generali DSS',
    managementFee: 0.0045,
    funds: [
      { key: 'index', name: 'Indexový negarantovaný d. f.', equityShare: 1.0 },
      { key: 'growth', name: 'Akciový negarantovaný d. f.', equityShare: 0.8 },
      { key: 'conservative', name: 'Dlhopisový garantovaný d. f.', equityShare: 0.0 },
    ],
  },
];

/**
 * Doplnkové dôchodkové spoločnosti (III. pilier).
 *
 * Odplata za správu je v treťom pilieri výrazne vyššia než v druhom a je
 * hlavnou príčinou rozdielu voči vlastnému portfóliu z indexových ETF.
 */
export const DDS_PROVIDERS: PensionProvider[] = [
  {
    id: 'nn',
    company: 'NN Tatry – Sympatia DDS',
    managementFee: 0.011,
    funds: [
      { key: 'index', name: 'Indexový príspevkový d. d. f.', equityShare: 1.0 },
      { key: 'growth', name: 'Akciový príspevkový d. d. f.', equityShare: 0.75 },
      { key: 'conservative', name: 'Konzervatívny príspevkový d. d. f.', equityShare: 0.0 },
    ],
  },
  {
    id: 'stabilita',
    company: 'STABILITA DDS',
    managementFee: 0.0125,
    funds: [
      { key: 'index', name: 'Indexový príspevkový d. d. f.', equityShare: 1.0 },
      { key: 'growth', name: 'Rastový príspevkový d. d. f.', equityShare: 0.7 },
      { key: 'conservative', name: 'Konzervatívny príspevkový d. d. f.', equityShare: 0.0 },
    ],
  },
  {
    id: 'tatra-dds',
    company: 'DDS Tatra banky',
    managementFee: 0.012,
    funds: [
      { key: 'index', name: 'Indexový príspevkový d. d. f.', equityShare: 1.0 },
      { key: 'growth', name: 'Rastový príspevkový d. d. f.', equityShare: 0.7 },
      { key: 'conservative', name: 'Konzervatívny príspevkový d. d. f.', equityShare: 0.0 },
    ],
  },
];

/** Pásma hrubej mesačnej mzdy použité na odhad odvodu do II. piliera. */
export interface WageBand {
  id: string;
  label: string;
  /** Reprezentatívna hrubá mesačná mzda pásma. */
  gross: number;
}

export const WAGE_BANDS: WageBand[] = [
  { id: 'b1', label: 'do 1 000 €', gross: 900 },
  { id: 'b2', label: '1 000 – 1 500 €', gross: 1250 },
  { id: 'b3', label: '1 500 – 2 200 €', gross: 1850 },
  { id: 'b4', label: 'nad 2 200 €', gross: 2800 },
];

export const wageBand = (id: string): WageBand =>
  WAGE_BANDS.find((b) => b.id === id) ?? WAGE_BANDS[2];
