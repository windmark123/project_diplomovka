/**
 * Formátovanie čísel podľa slovenských konvencií.
 *
 * Medzi číslom a jednotkou stojí pevná medzera (U+00A0). Slovenská
 * typografia ju vyžaduje a zároveň bráni tomu, aby sa „18 %" zalomilo na
 * dva riadky — čo sa vo veľkých nadpisoch a v bunkách tabuliek stáva.
 */

/** Pevná medzera oddeľujúca hodnotu od jednotky. */
const NBSP = '\u00A0';

const nf = (min: number, max: number) =>
  new Intl.NumberFormat('sk-SK', { minimumFractionDigits: min, maximumFractionDigits: max });

const money0 = nf(0, 0);
const money2 = nf(2, 2);

/** Celé euro bez desatinných miest, napr. „156 400“. */
export const eur = (v: number): string => money0.format(Math.round(v));

/** Euro so znakom meny. */
export const eurSign = (v: number): string => `${eur(v)}${NBSP}€`;

/** Euro s dvoma desatinnými miestami. */
export const eur2 = (v: number): string => money2.format(v);

/** Skrátený zápis veľkých súm pre osi grafov: 156 400 → „156 tis.“. */
export function eurShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${nf(0, 2).format(v / 1_000_000)}${NBSP}mil.`;
  if (abs >= 10_000) return `${money0.format(Math.round(v / 1000))}${NBSP}tis.`;
  return money0.format(Math.round(v));
}

/** Percento z podielu: 0,0425 → „4,3 %“. */
export const pct = (v: number, digits = 1): string =>
  `${nf(digits, digits).format(v * 100)}${NBSP}%`;

/** Percentuálny bod bez znaku meny: 62,5 → „62,5 %“. */
export const pctValue = (v: number, digits = 1): string =>
  `${nf(digits, digits).format(v)}${NBSP}%`;

/** Číslo so znamienkom, napr. „+12 400“ alebo „−3 100“. */
export function signed(v: number, format: (n: number) => string = eur): string {
  if (v > 0) return `+${format(v)}`;
  if (v < 0) return `−${format(Math.abs(v))}`;
  return format(0);
}

/** Pomerový ukazovateľ na dve desatinné miesta, napr. Sharpe „0,42“. */
export const ratio = (v: number): string => nf(2, 2).format(v);

/** Slovenské skloňovanie po číslovke: 1 rok, 2–4 roky, 5+ rokov. */
export function years(n: number): string {
  if (n === 1) return '1 rok';
  if (n >= 2 && n <= 4) return `${n} roky`;
  return `${n} rokov`;
}

/** Skloňovanie pre otázky: 1 otázka, 2–4 otázky, 5+ otázok. */
export function questions(n: number): string {
  if (n === 1) return '1 otázka';
  if (n >= 2 && n <= 4) return `${n} otázky`;
  return `${n} otázok`;
}

/** Skloňovanie pre chýbajúce odpovede. */
export function answersMissing(n: number): string {
  if (n === 1) return '1 odpoveď';
  if (n >= 2 && n <= 4) return `${n} odpovede`;
  return `${n} odpovedí`;
}
