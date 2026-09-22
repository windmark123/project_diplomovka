/**
 * Vyhodnotenie rizikového profilu investora.
 *
 * Postup zodpovedá logike posúdenia vhodnosti podľa MiFID II:
 *
 *   1. Každá oblasť sa oskóruje samostatne a normalizuje na interval ⟨0; 1⟩.
 *   2. Oblasti sa vážia (vedomosti 0,20 · kapacita 0,30 · tolerancia 0,35)
 *      a súčet sa prenásobí na ⟨0; 1⟩ — preferencie udržateľnosti majú váhu 0.
 *   3. Výsledok sa zaradí do jedného zo štyroch profilov.
 *   4. Na záver sa uplatnia poistky, ktoré môžu profil už len znížiť, nikdy
 *      nie zvýšiť. Tým sa premieta požiadavka, že schopnosť znášať straty
 *      a investičný horizont sú tvrdé obmedzenia, nie ďalšia vážená položka.
 */

import {
  AREAS,
  QUESTIONS,
  questionsForArea,
  type Answers,
  type AreaId,
} from '@/data/questionnaire';

export type ProfileId = 'conservative' | 'balanced' | 'growth' | 'dynamic';

export interface Profile {
  id: ProfileId;
  name: string;
  /** Prípustné pásmo akciovej zložky v percentách [min, max]. */
  equityBand: [number, number];
  lead: string;
  /** Odporúčanie, ktoré sa zobrazí vo výstupe práce. */
  recommendation: string;
}

export const PROFILES: Profile[] = [
  {
    id: 'conservative',
    name: 'Konzervatívny',
    equityBand: [10, 35],
    lead: 'Prioritou je stabilita hodnoty. Model drží akciovú zložku nízko a spolieha sa na pravidelnosť vkladov, nie na výnos.',
    recommendation:
      'Pri tomto profile je vlastné portfólio doplnkom, nie náhradou. Väčšinu dôchodkového zabezpečenia nechajte na I. a II. pilieri a vlastnú investíciu používajte na vyrovnanie výpadku medzi mzdou a dôchodkom. Pred navýšením akciovej zložky riešte najskôr finančnú rezervu.',
  },
  {
    id: 'balanced',
    name: 'Vyvážený',
    equityBand: [35, 60],
    lead: 'Rast s tlmenými výkyvmi. Akciová zložka je v menšine alebo mierne nad polovicou, zvyšok stabilizujú dlhopisy a hotovosť.',
    recommendation:
      'Vlastné portfólio dáva pri tomto profile zmysel ako plnohodnotný tretí zdroj popri I. a II. pilieri. Rozdiel oproti III. pilieru vzniká predovšetkým nákladovosťou — ak využívate príspevok zamestnávateľa do DDS, kombinujte obe cesty.',
  },
  {
    id: 'growth',
    name: 'Rastový',
    equityBand: [60, 80],
    lead: 'Dlhý horizont a schopnosť zniesť pokles znamenajú, že prevažuje akciová zložka. Pokles o štvrtinu hodnoty je v tomto profile bežný scenár, nie výnimka.',
    recommendation:
      'Vlastné portfólio je pri tomto profile najsilnejšou z porovnávaných ciest. Rozhodujúce je vydržať poklesy bez zmeny plánu — preto je v modeli zapnuté postupné znižovanie rizika pred koncom horizontu.',
  },
  {
    id: 'dynamic',
    name: 'Dynamický',
    equityBand: [80, 95],
    lead: 'Takmer celé portfólio nesie akciové riziko. Model to pripúšťa len pri dlhom horizonte a dostatočnej finančnej rezerve.',
    recommendation:
      'Najvyšší očakávaný výnos aj najvyššia disperzia výsledkov. Vlastné portfólio prekonáva oba piliere najmä nižšou nákladovosťou a oslobodením od dane po splnení časového testu. Za to nesiete plné trhové riziko bez akejkoľvek garancie.',
  },
];

export const profileById = (id: ProfileId): Profile => {
  const found = PROFILES.find((p) => p.id === id);
  if (!found) throw new Error(`Neznámy profil: ${id}`);
  return found;
};

export interface AreaScore {
  id: AreaId;
  name: string;
  /** Normalizované skóre oblasti v intervale ⟨0; 1⟩. */
  value: number;
  /** Počet zodpovedaných otázok v oblasti. */
  answered: number;
  total: number;
}

export interface ProfileResult {
  profile: Profile;
  /** Index profilu v poli `PROFILES` (0–3). */
  index: number;
  /** Vážené rizikové skóre v percentách (0–100). */
  score: number;
  areas: AreaScore[];
  /** Nízka finančná kapacita znížila profil o jeden stupeň. */
  cappedByCapacity: boolean;
  /** Krátky horizont obmedzil profil. */
  cappedByHorizon: boolean;
  /** Profil, ktorý by vyšiel zo samotného skóre, bez poistiek. */
  rawIndex: number;
  answeredCount: number;
  isComplete: boolean;
}

/** Normalizované skóre jednej oblasti v intervale ⟨0; 1⟩. */
const areaValue = (area: AreaId, answers: Answers): { value: number; answered: number; total: number } => {
  const qs = questionsForArea(area);
  let got = 0;
  let max = 0;
  let answered = 0;
  for (const q of qs) {
    max += q.max;
    const chosen = q.options.find((o) => o.key === answers[q.id]);
    if (chosen) {
      got += chosen.score;
      answered += 1;
    }
  }
  return { value: max > 0 ? got / max : 0, answered, total: qs.length };
};

/** Hranice medzi profilmi na normalizovanom skóre. */
const BANDS = [0.3, 0.52, 0.74];

/** Pod touto úrovňou skóre kapacity sa profil znižuje o jeden stupeň. */
const LOW_CAPACITY_THRESHOLD = 0.35;

export interface ProfileInput {
  answers: Answers;
  /** Investičný horizont v rokoch. */
  horizon: number;
}

export function evaluateProfile({ answers, horizon }: ProfileInput): ProfileResult {
  const areas: AreaScore[] = AREAS.map((a) => {
    const { value, answered, total } = areaValue(a.id, answers);
    return { id: a.id, name: a.full, value, answered, total };
  });

  // Vážený súčet cez oblasti s nenulovou váhou, prenásobený na ⟨0; 1⟩.
  const weightSum = AREAS.reduce((s, a) => s + a.weight, 0);
  const weighted = AREAS.reduce((s, a) => {
    const area = areas.find((x) => x.id === a.id);
    return s + (area ? area.value : 0) * a.weight;
  }, 0);
  const normalized = weightSum > 0 ? weighted / weightSum : 0;

  const rawIndex = BANDS.reduce((idx, threshold) => (normalized >= threshold ? idx + 1 : idx), 0);
  let index = rawIndex;

  // Poistka 1 — schopnosť znášať straty. Nízka kapacita znižuje profil
  // bez ohľadu na to, akú toleranciu rizika sporiteľ deklaruje.
  const capacity = areas.find((a) => a.id === 'kapacita');
  const cappedByCapacity = !!capacity && capacity.value < LOW_CAPACITY_THRESHOLD && index > 1;
  if (cappedByCapacity) index -= 1;

  // Poistka 2 — investičný horizont. Krátky horizont nedáva akciovej zložke
  // priestor odpracovať pokles, preto strop na profil.
  let cappedByHorizon = false;
  if (horizon < 10 && index > 1) {
    index = 1;
    cappedByHorizon = true;
  } else if (horizon < 15 && index > 2) {
    index = 2;
    cappedByHorizon = true;
  }

  const answeredCount = QUESTIONS.filter((q) => answers[q.id] !== undefined).length;

  return {
    profile: PROFILES[index],
    index,
    score: Math.round(normalized * 100),
    areas,
    cappedByCapacity,
    cappedByHorizon,
    rawIndex,
    answeredCount,
    isComplete: answeredCount === QUESTIONS.length,
  };
}

/** Stred prípustného pásma akciovej zložky profilu. */
export const bandMidpoint = (profile: Profile): number =>
  (profile.equityBand[0] + profile.equityBand[1]) / 2;

/** Preferencia udržateľnosti odvodená z poslednej oblasti dotazníka (0–1). */
export function sustainabilityPreference(answers: Answers): number {
  const { value } = areaValue('udrzatelnost', answers);
  return value;
}
