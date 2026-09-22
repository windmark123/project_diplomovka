/**
 * Pohybová vrstva.
 *
 * Animácia tu nie je ozdoba. Plní tri úlohy:
 *
 *   • odkrývanie pri rolovaní vedie pozornosť cez dlhú stránku výsledkov
 *     a rozdeľuje ju na kapitoly,
 *   • prechod čísla medzi dvoma hodnotami ukazuje, že sa prepočítalo, a o koľko
 *     — skok by túto informáciu zahodil,
 *   • kreslenie krivky grafu dáva oku čas prečítať tvar priebehu skôr, než
 *     začne odčítavať hodnoty.
 *
 * Všetko rešpektuje `prefers-reduced-motion`. Pri zapnutom obmedzení sa
 * hodnoty nastavia okamžite a odkrývanie sa preskočí — obsah nesmie závisieť
 * od toho, či animácia prebehla.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

/** `true`, ak si používateľ v systéme vyžiadal obmedzenie pohybu. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

// ───────────────────────────────────────────────────────────────────────────
// Odkrývanie pri rolovaní
// ───────────────────────────────────────────────────────────────────────────

/**
 * Pridá prvku triedu `is-in`, keď sa dostane do zorného poľa.
 *
 * Sleduje sa len raz — po odkrytí sa pozorovanie ruší. Prvok, ktorý sa
 * skrýva a znovu odkrýva pri každom rolovaní hore-dole, pôsobí nervózne
 * a na dlhej stránke unavuje.
 */
export function useReveal<T extends HTMLElement>(options?: {
  /** Koľko z prvku musí byť viditeľné (0–1). */
  threshold?: number;
  /** Predsunutie spodnej hranice, aby sa prvok odkryl tesne pred vstupom. */
  rootMargin?: string;
}): RefObject<T> {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reduced || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in');
      return;
    }

    // Prvok, ktorý je viditeľný už pri načítaní, sa odkryje hneď.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        }
      },
      {
        threshold: options?.threshold ?? 0.12,
        rootMargin: options?.rootMargin ?? '0px 0px -8% 0px',
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced, options?.threshold, options?.rootMargin]);

  return ref;
}

interface RevealProps {
  children: ReactNode;
  /** Poradie v skupine; každý ďalší prvok sa odkryje o krok neskôr. */
  index?: number;
  className?: string;
  as?: 'div' | 'section' | 'li';
  style?: React.CSSProperties;
  id?: string;
}

/** Obal, ktorý svoj obsah odkryje po vstupe do zorného poľa. */
export function Reveal({ children, index = 0, className, as = 'div', style, id }: RevealProps) {
  const ref = useReveal<HTMLDivElement>();
  const Tag = as;
  return (
    <Tag
      id={id}
      ref={ref as RefObject<never>}
      className={['hz-reveal', className].filter(Boolean).join(' ')}
      style={{ ['--reveal-index' as string]: index, ...style }}
    >
      {children}
    </Tag>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Animované číslo
// ───────────────────────────────────────────────────────────────────────────

/** Tlmenie na konci — rýchly nábeh, pokojné dobehnutie. */
const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Plynulý prechod číselnej hodnoty.
 *
 * Pri zmene cieľa sa prechod nespustí od nuly, ale od práve zobrazenej
 * hodnoty. Bez toho by posun jedného posuvníka rozbehol číslo z nuly
 * zakaždým a pôsobilo by to ako načítavanie, nie ako prepočet.
 */
export function useAnimatedValue(target: number, duration = 850): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (reduced || !Number.isFinite(target)) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    if (from === target) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * easeOutExpo(t);
      fromRef.current = next;
      setValue(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, reduced]);

  return value;
}

interface AnimatedNumberProps {
  value: number;
  /** Formátovanie výslednej hodnoty. */
  format: (v: number) => string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Číslo, ktoré medzi hodnotami preteká namiesto skoku.
 *
 * Pre čítačky obrazovky sa vypisuje až konečná hodnota — priebežné medzistavy
 * by ich zaplavili. Preto `aria-label` s cieľom a skrytý priebeh.
 */
export function AnimatedNumber({
  value,
  format,
  duration,
  className,
  style,
}: AnimatedNumberProps) {
  const animated = useAnimatedValue(value, duration);
  const final = useMemo(() => format(value), [format, value]);
  return (
    <span
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
      aria-label={final}
    >
      <span aria-hidden="true">{format(animated)}</span>
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Kreslenie krivky
// ───────────────────────────────────────────────────────────────────────────

/**
 * Vráti vlastnosti pre `<path>`, ktorý sa pri prvom zobrazení nakreslí.
 *
 * Animuje sa len raz, pri prvom pripojení. Prekreslenie po zmene vstupu už
 * beží bez animácie — krivka, ktorá sa nanovo kreslí pri každom pohnutí
 * posuvníka, by znemožnila porovnávať tvary.
 */
export function useDrawIn(enabled = true): {
  ref: RefObject<SVGPathElement>;
  style: React.CSSProperties;
} {
  const ref = useRef<SVGPathElement>(null);
  const reduced = usePrefersReducedMotion();
  const drawnRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || drawnRef.current) return;
    if (!enabled || reduced) {
      drawnRef.current = true;
      return;
    }

    let length = 0;
    try {
      length = el.getTotalLength();
    } catch {
      // getTotalLength nie je dostupné pri prázdnej ceste.
    }
    if (!length) return;

    drawnRef.current = true;
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    // Vynútené prepočítanie, aby prehliadač zaznamenal východiskový stav.
    void el.getBoundingClientRect();
    el.style.transition = 'stroke-dashoffset 1400ms cubic-bezier(.16,1,.3,1)';
    el.style.strokeDashoffset = '0';

    const clear = () => {
      el.style.strokeDasharray = '';
      el.style.strokeDashoffset = '';
      el.style.transition = '';
    };
    el.addEventListener('transitionend', clear, { once: true });
    return () => el.removeEventListener('transitionend', clear);
  }, [enabled, reduced]);

  return { ref, style: {} };
}
