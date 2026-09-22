/**
 * Vodopádový rozklad konečnej hodnoty.
 *
 * Ukazuje, čo z vloženej sumy spraví zhodnotenie a koľko z toho odoberú
 * poplatky a daň. Je to bežný finančný zápis a odpovedá na otázku, ktorú
 * stĺpcové porovnanie nechá otvorenú: *kam sa rozdiel medzi cestami stratil.*
 *
 * Zhodnotenie sa počíta **pred poplatkami**, aby sa poplatok dal vykresliť
 * ako samostatný úbytok. Keby sa vychádzalo z hodnoty po poplatkoch, boli by
 * poplatky započítané dvakrát a súčet by nesedel.
 */

import { eurShort, eurSign } from '@/engine/format';
import { useChartWidth } from './primitives';

export interface WaterfallStep {
  label: string;
  /** Kladná hodnota pridáva, záporná uberá. */
  delta: number;
  kind: 'base' | 'gain' | 'loss' | 'total';
}

interface Props {
  steps: WaterfallStep[];
  height?: number;
  caption?: React.ReactNode;
  accent?: string;
}

export function ValueWaterfall({ steps, height = 220, caption, accent = 'var(--c-own)' }: Props) {
  const { ref, width } = useChartWidth<HTMLDivElement>();

  const pad = { top: 14, right: 12, bottom: 44, left: 12 };
  const innerW = Math.max(120, width - pad.left - pad.right);
  const innerH = Math.max(80, height - pad.top - pad.bottom);

  // Priebežné súčty určujú, kde stĺpec začína a kde končí.
  let running = 0;
  const bars = steps.map((s) => {
    const from = s.kind === 'total' || s.kind === 'base' ? 0 : running;
    const to = s.kind === 'total' ? s.delta : s.kind === 'base' ? s.delta : running + s.delta;
    if (s.kind !== 'total') running = to;
    return { ...s, from, to, lo: Math.min(from, to), hi: Math.max(from, to) };
  });

  const max = Math.max(1, ...bars.map((b) => b.hi));
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const slot = innerW / bars.length;
  const barW = Math.min(64, slot * 0.56);

  const colorOf = (kind: WaterfallStep['kind']) =>
    kind === 'loss' ? 'var(--neg-1)' : kind === 'gain' ? 'var(--pos-1)' : accent;

  return (
    <figure style={{ margin: 0, display: 'grid', gap: 'var(--s-5)' }}>
      <div ref={ref} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Rozklad konečnej hodnoty: ${steps
            .map((s) => `${s.label} ${eurSign(s.delta)}`)
            .join(', ')}`}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <line
            x1={pad.left}
            x2={pad.left + innerW}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--c-grid)"
            strokeWidth={1}
            shapeRendering="crispEdges"
          />

          {bars.map((b, i) => {
            const cx = pad.left + slot * i + slot / 2;
            const x = cx - barW / 2;
            const top = y(b.hi);
            const h = Math.max(2, y(b.lo) - y(b.hi));
            const isTotal = b.kind === 'total' || b.kind === 'base';
            return (
              <g key={b.label}>
                {/* Spojnica k ďalšiemu stĺpcu drží oko na priebežnom súčte. */}
                {i < bars.length - 1 && bars[i + 1].kind !== 'total' && (
                  <line
                    x1={cx + barW / 2}
                    x2={pad.left + slot * (i + 1) + slot / 2 - barW / 2}
                    y1={y(b.to)}
                    y2={y(b.to)}
                    stroke="var(--c-axis)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.6}
                  />
                )}
                <rect
                  x={x}
                  y={top}
                  width={barW}
                  height={h}
                  rx={4}
                  fill={colorOf(b.kind)}
                  opacity={isTotal ? 1 : 0.9}
                />
                <text
                  x={cx}
                  y={top - 8}
                  textAnchor="middle"
                  fill="var(--text-strong)"
                  style={{
                    font: '500 11.5px var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {b.delta < 0 ? `−${eurShort(Math.abs(b.delta))}` : eurShort(b.delta)}
                </text>
                <text
                  x={cx}
                  y={pad.top + innerH + 18}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  style={{ font: '400 11px var(--font-body)' }}
                >
                  {b.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {caption && (
        <figcaption className="hz-micro" style={{ margin: 0 }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
