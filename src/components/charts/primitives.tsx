/**
 * Spoločné stavebné prvky grafov.
 *
 * Grafy sú kreslené priamo v SVG bez externej knižnice. Dôvody sú tri:
 * výstup je plne kontrolovateľný a tlačiteľný, neprináša do práce ďalšiu
 * závislosť, ktorú by bolo treba archivovať, a veľkosť zostavenej aplikácie
 * zostáva v desiatkach kilobajtov.
 *
 * Značky dodržiavajú jednotnú špecifikáciu: čiara 2 px so zaoblenými koncami,
 * bod s polomerom aspoň 4 px a 2 px prstencom vo farbe podkladu, výplň plochy
 * pri ~10 % krytia, mriežka vlasovou čiarou o krok odlíšenou od podkladu.
 * Text nikdy nenesie farbu série — identitu nesie značka vedľa neho.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGIN: Margin = { top: 16, right: 16, bottom: 28, left: 56 };

/** Sleduje šírku kontajnera, aby sa SVG kreslilo v skutočných pixeloch. */
export function useChartWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') {
      setWidth(el.clientWidth || fallback);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);

  return { ref, width };
}

/** Lineárna škála z dátového rozsahu na pixely. */
export const scaleLinear = (d0: number, d1: number, r0: number, r1: number) => {
  const span = d1 - d0;
  return (v: number): number => (span === 0 ? r0 : r0 + ((v - d0) / span) * (r1 - r0));
};

/**
 * Zaokrúhli hornú hranicu osi na „peknú“ hodnotu a vráti hodnoty popisiek.
 * Os s hodnotami 0 / 50 000 / 100 000 sa číta lepšie než 0 / 47 312 / 94 624.
 *
 * Posledná značka je vždy väčšia alebo rovná `max`. Je to podmienka správnosti,
 * nie estetiky: horná značka určuje rozsah osi, takže keby ležala pod maximom
 * dát, krivky a body by sa vykreslili nad plochou grafu a používateľ by ich
 * nevidel.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const rawStep = max / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;

  // Horná hranica zaokrúhlená nahor na násobok kroku. Tolerancia ošetruje
  // prípad, keď max už násobkom kroku je a plávajúca čiarka ho minie o 1e-16.
  const steps = Math.ceil(max / step - 1e-9);
  const ticks: number[] = [];
  for (let i = 0; i <= steps; i++) {
    // Zaokrúhlenie potlačí artefakty typu 0,15000000000000002 v popiskách.
    ticks.push(Number((i * step).toPrecision(12)));
  }
  return ticks;
}

/**
 * Rozsah osi, ktorá nemusí začínať nulou.
 *
 * Pri grafoch dĺžky (stĺpce, plochy) je nulová základňa povinná — bez nej
 * dĺžka klame. Pri bodovom grafe je však poloha, nie dĺžka, takže vynútená
 * nula stlačí dáta do rohu a rozdiely zmizne. Funkcia preto vráti rozsah
 * obopínajúci dáta s rezervou a zaokrúhlený na násobky kroku.
 */
export function niceRange(
  min: number,
  max: number,
  count = 4,
): { lo: number; hi: number; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 1, ticks: [0, 1] };

  // Rezerva na oboch stranách, aby body neležali na hrane plochy.
  const span = Math.max(max - min, Math.abs(max) * 0.08, 1e-9);
  const padded = { min: min - span * 0.28, max: max + span * 0.28 };

  const rawStep = (padded.max - padded.min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;

  const lo = Math.floor(padded.min / step + 1e-9) * step;
  const hi = Math.ceil(padded.max / step - 1e-9) * step;

  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 1e-9; v += step) {
    ticks.push(Number(v.toPrecision(12)));
  }
  return { lo, hi, ticks };
}

/** Cesta lomenej čiary. */
export function linePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

/** Cesta uzavretej plochy medzi dvoma priebehmi. */
export function areaPath(
  upper: Array<{ x: number; y: number }>,
  lower: Array<{ x: number; y: number }>,
): string {
  if (upper.length === 0) return '';
  const down = [...lower].reverse();
  return `${linePath(upper)} L${down[0].x.toFixed(2)},${down[0].y.toFixed(2)} ${down
    .slice(1)
    .map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')} Z`;
}

interface GridProps {
  ticks: number[];
  y: (v: number) => number;
  x0: number;
  x1: number;
  format: (v: number) => string;
}

/** Vodorovná mriežka s popiskami osi y. */
export function GridY({ ticks, y, x0, x1, format }: GridProps) {
  return (
    <g aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={x0}
            x2={x1}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--c-grid)"
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
          <text
            x={x0 - 8}
            y={y(t)}
            textAnchor="end"
            dominantBaseline="middle"
            fill="var(--c-axis)"
            style={{ font: '400 11px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
          >
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

interface AxisXProps {
  ticks: number[];
  x: (v: number) => number;
  y: number;
  format: (v: number) => string;
}

export function AxisX({ ticks, x, y, format }: AxisXProps) {
  return (
    <g aria-hidden="true">
      {ticks.map((t) => (
        <text
          key={t}
          x={x(t)}
          y={y + 18}
          textAnchor="middle"
          fill="var(--c-axis)"
          style={{ font: '400 11px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
        >
          {format(t)}
        </text>
      ))}
    </g>
  );
}

/** Bod s prstencom vo farbe podkladu, aby zostal čitateľný cez čiary. */
export function Dot({ cx, cy, color, r = 4.5 }: { cx: number; cy: number; color: string; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r + 2} fill="var(--surface-card)" />
      <circle cx={cx} cy={cy} r={r} fill={color} />
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Popisok pri prejdení myšou
// ───────────────────────────────────────────────────────────────────────────

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

export function Tooltip({ state, width }: { state: TooltipState | null; width: number }) {
  if (!state) return null;
  // Popisok sa preklopí na druhú stranu kurzora, keď by pretiekol za okraj.
  const estimated = 190;
  const flip = state.x + estimated + 16 > width;
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        left: flip ? undefined : state.x + 14,
        right: flip ? width - state.x + 14 : undefined,
        top: Math.max(4, state.y - 12),
        pointerEvents: 'none',
        background: 'var(--ink-1)',
        color: 'var(--paper-1)',
        borderRadius: 'var(--r-md)',
        padding: '10px 12px',
        boxShadow: 'var(--shadow-lg)',
        fontSize: 'var(--fs-micro)',
        lineHeight: 1.5,
        zIndex: 5,
        minWidth: 150,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{state.title}</div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {state.rows.map((r) => (
            <tr key={r.label}>
              <td style={{ paddingRight: 10, whiteSpace: 'nowrap' }}>
                {r.color && (
                  <i
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: r.color,
                      marginRight: 6,
                    }}
                  />
                )}
                {r.label}
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Prepočíta pozíciu kurzora na index najbližšieho dátového bodu. */
export function useNearestIndex(
  x: (v: number) => number,
  domain: number[],
): [number | null, (e: React.MouseEvent<SVGSVGElement>) => void, () => void] {
  const [index, setIndex] = useState<number | null>(null);

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < domain.length; i++) {
        const d = Math.abs(x(domain[i]) - px);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setIndex(best);
    },
    [x, domain],
  );

  const onLeave = useCallback(() => setIndex(null), []);
  return [index, onMove, onLeave];
}

// ───────────────────────────────────────────────────────────────────────────

export interface LegendItem {
  label: string;
  color: string;
  /** Prerušovaná čiara pre pomocné série. */
  dashed?: boolean;
  shape?: 'line' | 'dot' | 'swatch';
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="hz-legend">
      {items.map((it) => (
        <span key={it.label}>
          <i
            className={it.shape === 'dot' ? 'dot' : undefined}
            style={{
              background: it.dashed
                ? `repeating-linear-gradient(90deg, ${it.color} 0 4px, transparent 4px 7px)`
                : it.color,
              ...(it.shape === 'swatch' ? { width: 12, height: 12, borderRadius: 3 } : null),
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Obal grafu: relatívne pozicovanie kvôli popisku a rezerva na legendu. */
export function ChartFrame({
  children,
  legend,
  caption,
  innerRef,
}: {
  children: ReactNode;
  legend?: LegendItem[];
  caption?: ReactNode;
  innerRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <figure style={{ margin: 0, display: 'grid', gap: 'var(--s-5)' }}>
      {/* `minWidth: 0` je nutné: bez neho si flexový alebo mriežkový predok
          vynúti šírku podľa obsahu, SVG s pevnou šírkou v pixeloch ju zafixuje
          a na úzkej obrazovke pretečie celá stránka do strany. */}
      <div ref={innerRef} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
        {children}
      </div>
      {legend && <Legend items={legend} />}
      {caption && (
        <figcaption className="hz-micro" style={{ margin: 0 }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
