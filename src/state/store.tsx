/**
 * Stav aplikácie.
 *
 * Celý stav je jeden serializovateľný objekt. Vďaka tomu sa dá uložiť do
 * localStorage, zakódovať do adresy a znovu načítať — konkrétny výpočet je
 * tak zdieľateľný odkazom a v práci citovateľný. Žiadne dáta neopúšťajú
 * prehliadač.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Answers } from '@/data/questionnaire';
import type { FundRisk } from '@/data/pillars';
import { DEFAULT_FUNDS } from '@/data/assets';
import {
  DEFAULT_GLIDEPATH,
  type Allocation,
  type FundSelection,
  type GlidepathConfig,
  type VariantId,
} from '@/engine/portfolio';

export type Theme = 'day' | 'night';

export interface AppState {
  /** Odpovede dotazníka. */
  answers: Answers;
  /** Investičný horizont v rokoch. */
  horizon: number;
  /** Mesačný vklad v eurách. */
  monthly: number;
  /** Mzdové pásmo pre odhad odvodu do II. piliera. */
  wageBandId: string;
  /** Rizikovosť fondu v II. a III. pilieri. */
  fundRisk: FundRisk;
  dssId: string;
  ddsId: string;
  useTaxRelief: boolean;
  /** Zosúladiť rizikovosť fondov s vlastným portfóliom. */
  riskMatched: boolean;
  /** Zvolený variant portfólia; `null` znamená vlastné zloženie. */
  variant: VariantId | null;
  /** Ručne upravené váhy; použijú sa, keď `variant` je `null`. */
  customAllocation: Allocation | null;
  funds: FundSelection;
  glidepath: GlidepathConfig;
  /** Počet ciest Monte Carlo simulácie. */
  paths: number;
  /** Krok dotazníka (0–4). */
  step: number;
  theme: Theme;
}

export const DEFAULT_STATE: AppState = {
  answers: {},
  horizon: 30,
  monthly: 150,
  wageBandId: 'b3',
  fundRisk: 'index',
  dssId: 'allianz',
  ddsId: 'nn',
  useTaxRelief: true,
  riskMatched: true,
  variant: 'market',
  customAllocation: null,
  funds: { ...DEFAULT_FUNDS },
  glidepath: { ...DEFAULT_GLIDEPATH },
  paths: 2000,
  step: 0,
  theme: 'day',
};

const STORAGE_KEY = 'stvrty-pilier.state.v1';

/**
 * Kľúč používaný pred premenovaním aplikácie.
 *
 * Číta sa len ako záloha, keď pod novým kľúčom nič nie je. Bez toho by
 * sporiteľ, ktorý si dotazník vyplnil pred premenovaním, o odpovede prišiel.
 */
const LEGACY_STORAGE_KEY = 'horizont.state.v1';

/** Polia, ktoré sa prenášajú v zdieľanom odkaze. Krok a téma do neho nepatria. */
const SHARED_KEYS: Array<keyof AppState> = [
  'answers',
  'horizon',
  'monthly',
  'wageBandId',
  'fundRisk',
  'dssId',
  'ddsId',
  'useTaxRelief',
  'riskMatched',
  'variant',
  'customAllocation',
  'funds',
  'glidepath',
  'paths',
];

/** Kódovanie do URL-bezpečného base64 s podporou diakritiky. */
function encodeState(state: AppState): string {
  const subset: Partial<AppState> = {};
  for (const key of SHARED_KEYS) (subset as Record<string, unknown>)[key] = state[key];
  const json = JSON.stringify(subset);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(encoded: string): Partial<AppState> | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Partial<AppState>;
  } catch {
    return null;
  }
}

/** Zlúči uložený stav s predvoleným a odfiltruje neplatné hodnoty. */
function merge(base: AppState, patch: Partial<AppState> | null): AppState {
  if (!patch) return base;
  const next: AppState = { ...base, ...patch };
  // Vnorené objekty sa zlučujú, nie nahrádzajú — inak by staršia uložená
  // verzia bez novej triedy aktív spôsobila chýbajúci kľúč.
  next.funds = { ...base.funds, ...(patch.funds ?? {}) };
  next.glidepath = { ...base.glidepath, ...(patch.glidepath ?? {}) };
  next.answers = { ...(patch.answers ?? {}) };
  next.horizon = Math.min(45, Math.max(5, Number(next.horizon) || base.horizon));
  next.monthly = Math.min(3000, Math.max(10, Number(next.monthly) || base.monthly));
  next.paths = [500, 1000, 2000, 5000, 10000].includes(next.paths) ? next.paths : base.paths;
  next.step = Math.min(4, Math.max(0, Number(next.step) || 0));
  return next;
}

function loadInitial(): AppState {
  if (typeof window === 'undefined') return DEFAULT_STATE;

  // Odkaz má prednosť pred uloženým stavom — zdieľaný výpočet musí vyzerať
  // rovnako u autora aj u čitateľa práce.
  const hash = window.location.hash;
  const shareIndex = hash.indexOf('s=');
  if (shareIndex >= 0) {
    const fromUrl = decodeState(hash.slice(shareIndex + 2));
    if (fromUrl) return merge(DEFAULT_STATE, fromUrl);
  }

  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) return merge(DEFAULT_STATE, JSON.parse(raw) as Partial<AppState>);
  } catch {
    // Nedostupné úložisko nie je dôvod, aby aplikácia nenaštartovala.
  }
  return DEFAULT_STATE;
}

interface StoreValue {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
  setAnswer: (questionId: string, optionKey: string) => void;
  reset: () => void;
  /** Adresa, ktorá obnoví presne tento výpočet. */
  shareUrl: () => string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Súkromný režim prehliadača — stav zostane len v pamäti.
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme === 'night' ? 'night' : 'day';
  }, [state.theme]);

  const set = useCallback((patch: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setAnswer = useCallback((questionId: string, optionKey: string) => {
    setState((prev) => ({ ...prev, answers: { ...prev.answers, [questionId]: optionKey } }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Ignorujeme — stav je aj tak prepísaný v pamäti.
    }
  }, []);

  const shareUrl = useCallback(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const route = window.location.hash.split('?')[0] || '#/vysledky';
    return `${base}${route}?s=${encodeState(state)}`;
  }, [state]);

  const value = useMemo<StoreValue>(
    () => ({ state, set, setAnswer, reset, shareUrl }),
    [state, set, setAnswer, reset, shareUrl],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore musí byť použitý vnútri StoreProvider');
  return ctx;
}
