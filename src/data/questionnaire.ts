/**
 * Dotazník na profiláciu investora podľa smernice MiFID II.
 *
 * Smernica 2014/65/EÚ (MiFID II) v čl. 25 ods. 2 a delegované nariadenie
 * (EÚ) 2017/565 v čl. 54 vyžadujú, aby posúdenie vhodnosti pokrylo tri oblasti:
 *
 *   1. vedomosti a skúsenosti klienta v oblasti investícií,
 *   2. finančnú situáciu vrátane schopnosti znášať straty,
 *   3. investičné ciele vrátane tolerancie rizika.
 *
 * Od augusta 2022 delegované nariadenie (EÚ) 2021/1253 dopĺňa štvrtú oblasť —
 * preferencie udržateľnosti. Tá sa podľa nariadenia zisťuje až po určení
 * rizikového profilu a nesmie ho meniť; v modeli preto vstupuje do výberu
 * konkrétnych fondov, nie do skóre.
 */

export type AreaId = 'vedomosti' | 'kapacita' | 'tolerancia' | 'udrzatelnost';

export interface Area {
  id: AreaId;
  /** Krátky názov pre indikátor krokov. */
  name: string;
  /** Plný názov oblasti. */
  full: string;
  /**
   * Váha oblasti v celkovom rizikovom skóre. Oblasť udržateľnosti má váhu 0,
   * pretože podľa nariadenia (EÚ) 2021/1253 nesmie ovplyvniť rizikový profil.
   */
  weight: number;
  title: string;
  lead: string;
}

export const AREAS: Area[] = [
  {
    id: 'vedomosti',
    name: 'Vedomosti',
    full: 'Vedomosti a skúsenosti',
    weight: 0.2,
    title: 'Vedomosti a skúsenosti',
    lead: 'Zisťujeme, s čím ste už pracovali. Neznalosť nie je chyba — mení len to, čo vám model navrhne.',
  },
  {
    id: 'kapacita',
    name: 'Kapacita',
    full: 'Finančná kapacita',
    weight: 0.3,
    title: 'Finančná kapacita',
    lead: 'Koľko rizika si môžete dovoliť bez toho, aby ste museli investíciu predať v nevhodnom čase.',
  },
  {
    id: 'tolerancia',
    name: 'Tolerancia',
    full: 'Tolerancia rizika',
    weight: 0.35,
    title: 'Tolerancia rizika',
    lead: 'Koľko poklesu znesiete bez toho, aby ste zmenili plán. Odpovedzte podľa toho, ako by ste sa naozaj zachovali.',
  },
  {
    id: 'udrzatelnost',
    name: 'Udržateľnosť',
    full: 'Preferencie udržateľnosti',
    weight: 0,
    title: 'Udržateľnosť a preferencie',
    lead: 'Preferencie ESG neovplyvňujú rizikové skóre. Ovplyvňujú výber konkrétnych fondov.',
  },
];

export interface QuestionOption {
  key: string;
  label: string;
  score: number;
}

export interface Question {
  id: string;
  area: AreaId;
  /** Poradové číslo pre zobrazenie, napr. „04“. */
  num: string;
  text: string;
  options: QuestionOption[];
  /** Najvyššie dosiahnuteľné skóre otázky (na normalizáciu). */
  max: number;
}

type RawQuestion = [AreaId, string, Array<[string, number]>];

const RAW: RawQuestion[] = [
  ['vedomosti', 'Ako by ste opísali svoje skúsenosti s investovaním?', [
    ['Nikdy som neinvestoval', 0],
    ['Mám sporenie alebo termínovaný vklad', 1],
    ['Investujem do fondov alebo ETF niekoľko rokov', 2],
    ['Aktívne spravujem portfólio vrátane jednotlivých akcií', 3],
  ]],
  ['vedomosti', 'Viete vysvetliť, čo znamená TER fondu?', [
    ['Nie', 0],
    ['Približne — vnímam to ako poplatok', 1],
    ['Áno, je to ročná nákladovosť fondu', 3],
  ]],
  ['vedomosti', 'Ako rozumiete vzťahu medzi rizikom a výnosom?', [
    ['Nie som si istý', 0],
    ['Vyšší výnos zvyčajne znamená vyššie riziko', 2],
    ['Rozumiem aj tomu, že riziko sa dá riadiť diverzifikáciou a horizontom', 3],
  ]],
  ['vedomosti', 'Prežili ste už ako investor výraznejší pokles trhu?', [
    ['Nie', 0],
    ['Áno, a bolo mi nepríjemne', 1],
    ['Áno, a plán som nemenil', 3],
  ]],

  ['kapacita', 'Aká časť vášho mesačného príjmu vám po výdavkoch zostáva?', [
    ['Takmer nič', 0],
    ['Do 10 %', 1],
    ['10 až 25 %', 2],
    ['Viac ako 25 %', 3],
  ]],
  ['kapacita', 'Máte finančnú rezervu na neočakávané výdavky?', [
    ['Nemám', 0],
    ['Na jeden až dva mesiace', 1],
    ['Na tri až šesť mesiacov', 2],
    ['Na viac ako šesť mesiacov', 3],
  ]],
  ['kapacita', 'Ako stabilný je váš príjem?', [
    ['Nepravidelný', 0],
    ['Mierne premenlivý', 1],
    ['Stabilný zamestnanecký príjem', 2],
    ['Stabilný a diverzifikovaný z viacerých zdrojov', 3],
  ]],
  ['kapacita', 'Máte záväzky, ktoré by vás mohli prinútiť investíciu predať?', [
    ['Áno, väčšie splátky alebo plánované výdavky', 0],
    ['Menšie záväzky', 1],
    ['Žiadne podstatné', 3],
  ]],

  ['tolerancia', 'Hodnota portfólia klesne v priebehu roka o 25 %. Čo urobíte?', [
    ['Všetko predám', 0],
    ['Časť predám', 1],
    ['Nechám to bez zmeny', 2],
    ['Dokúpim', 3],
  ]],
  ['tolerancia', 'Aký ročný pokles hodnoty ste ochotní zniesť?', [
    ['Žiadny', 0],
    ['Do 10 %', 1],
    ['Do 25 %', 2],
    ['Aj viac ako 35 %', 3],
  ]],
  ['tolerancia', 'Čo je pre vás dôležitejšie?', [
    ['Istota, že o vloženú sumu neprídem', 0],
    ['Prevaha istoty s malým rastom', 1],
    ['Rovnováha rastu a stability', 2],
    ['Najvyšší dlhodobý výnos, aj za cenu prudkých výkyvov', 3],
  ]],
  ['tolerancia', 'Ako často by ste chceli kontrolovať hodnotu portfólia?', [
    ['Denne — kolísanie ma znervózňuje', 0],
    ['Mesačne', 1],
    ['Raz či dvakrát do roka', 3],
  ]],

  ['udrzatelnost', 'Chcete, aby fondy zohľadňovali environmentálne a sociálne kritériá?', [
    ['Nie je to pre mňa dôležité', 0],
    ['Skôr áno, ak to nezhorší výnos', 2],
    ['Áno, je to podmienka', 3],
  ]],
  ['udrzatelnost', 'Vylúčili by ste odvetvia ako fosílne palivá alebo zbrojenie?', [
    ['Nie', 0],
    ['Zvážil by som to', 1],
    ['Áno, vylúčil', 3],
  ]],
  ['udrzatelnost', 'Ste ochotní akceptovať vyššie TER za ESG variant fondu?', [
    ['Nie', 0],
    ['Do 0,1 p. b.', 2],
    ['Áno, aj viac', 3],
  ]],
  ['udrzatelnost', 'Sledujete udržateľnosť aj pri iných finančných rozhodnutiach?', [
    ['Nie', 0],
    ['Občas', 1],
    ['Pravidelne', 3],
  ]],
];

export const QUESTIONS: Question[] = RAW.map((q, i) => ({
  id: `q${i + 1}`,
  area: q[0],
  num: String(i + 1).padStart(2, '0'),
  text: q[1],
  options: q[2].map((o, j) => ({ key: `o${j}`, label: o[0], score: o[1] })),
  max: Math.max(...q[2].map((o) => o[1])),
}));

export const QUESTION_COUNT = QUESTIONS.length;

export const questionsForArea = (area: AreaId): Question[] =>
  QUESTIONS.filter((q) => q.area === area);

/** Odpovede používateľa: id otázky → kľúč zvolenej možnosti. */
export type Answers = Record<string, string | undefined>;
